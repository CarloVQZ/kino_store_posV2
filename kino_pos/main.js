const { app, BrowserWindow, ipcMain, dialog } = require('electron')
const path = require('path')
const fs = require('fs')
const crypto = require('crypto')

if (!process.env.KINO_DATA_DIR) {
  process.env.KINO_DATA_DIR = app.getPath('userData')
}

const db = require('./database/db')
const cajaService = require('./database/cajaService')

let mainWindow

// Directorio para imágenes de productos
const imagesDir = path.join(process.env.KINO_DATA_DIR, 'images')
if (!fs.existsSync(imagesDir)) {
  fs.mkdirSync(imagesDir, { recursive: true })
}

// Insertar productos de prueba si la tabla está vacía
function insertarProductosDePrueba() {
  try {
    const count = db.prepare('SELECT COUNT(*) as total FROM producto').get()
    if (count.total === 0) {
      const productosDemo = [
        { nombre: 'Gorra Básica Negra', tipo: 'gorra', precio: 150, stock: 10, stock_minimo: 5 },
        { nombre: 'Gorra Deportiva Azul', tipo: 'gorra', precio: 180, stock: 2, stock_minimo: 5 },
        { nombre: 'Gorra Vintage Roja', tipo: 'gorra', precio: 200, stock: 0, stock_minimo: 5 },
        { nombre: 'Playera Clásica Blanca', tipo: 'playera', precio: 120, stock: 15, stock_minimo: 5 },
        { nombre: 'Playera Premium Gris', tipo: 'playera', precio: 250, stock: 3, stock_minimo: 5 },
        { nombre: 'Playera Oversized Negro', tipo: 'playera', precio: 280, stock: 0, stock_minimo: 5 },
      ]

      productosDemo.forEach(p => {
        db.prepare(
          'INSERT INTO producto (nombre, tipo, precio, stock, stock_minimo) VALUES (?, ?, ?, ?, ?)'
        ).run(p.nombre, p.tipo, p.precio, p.stock, p.stock_minimo)
      })

      console.log('✓ Productos de prueba insertados')
    }
  } catch (err) {
    console.error('Error insertando productos de prueba:', err.message)
  }
}

// ──────────────────────────────────────
// IPC handlers — la BD vive en main process
// ──────────────────────────────────────

// Productos
ipcMain.handle('db:getProductos', () => {
  return db.prepare('SELECT * FROM producto').all()
})

ipcMain.handle('db:addProducto', (_e, nombre, tipo, precio, stock, stock_minimo, imagen) => {
  return db.prepare(
    'INSERT INTO producto (nombre, tipo, precio, stock, stock_minimo, imagen) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(nombre, tipo, precio, stock, stock_minimo, imagen || null)
})

ipcMain.handle('db:updateStock', (_e, id, stock) => {
  return db.prepare('UPDATE producto SET stock = ? WHERE id = ?').run(stock, id)
})

ipcMain.handle('db:updateProducto', (_e, id, nombre, tipo, precio, stock, stock_minimo, imagen) => {
  return db.prepare(
    'UPDATE producto SET nombre=?, tipo=?, precio=?, stock=?, stock_minimo=?, imagen=? WHERE id=?'
  ).run(nombre, tipo, precio, stock, stock_minimo, imagen || null, id)
})

// Imágenes
ipcMain.handle('dialog:selectImage', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Seleccionar imagen del producto',
    filters: [{ name: 'Imágenes', extensions: ['jpg', 'jpeg', 'png', 'webp', 'gif'] }],
    properties: ['openFile']
  })
  if (result.canceled || result.filePaths.length === 0) return null
  return result.filePaths[0]
})

ipcMain.handle('image:save', (_e, sourcePath) => {
  try {
    const ext = path.extname(sourcePath)
    const filename = `prod_${Date.now()}${ext}`
    const destPath = path.join(imagesDir, filename)
    fs.copyFileSync(sourcePath, destPath)
    return filename
  } catch (err) {
    console.error('Error copiando imagen:', err)
    return null
  }
})

ipcMain.handle('image:getPath', (_e, filename) => {
  if (!filename) return null
  return path.join(imagesDir, filename)
})
// Usuarios y Autenticación
ipcMain.handle('db:getUsuariosActivos', () => {
  return db.prepare('SELECT id, nombre, usuario, rol FROM usuario WHERE activo = 1').all()
})

ipcMain.handle('db:login', (_e, usuario, pin) => {
  const pinHash = crypto.createHash('sha256').update(pin).digest('hex')
  const user = db.prepare('SELECT id, nombre, usuario, rol FROM usuario WHERE usuario = ? AND pin = ? AND activo = 1').get(usuario, pinHash)
  if (!user) throw new Error('PIN incorrecto o usuario inactivo')
  return user
})

ipcMain.handle('db:getUsuarios', () => {
  return db.prepare('SELECT id, nombre, usuario, rol, activo FROM usuario ORDER BY rol, nombre').all()
})

ipcMain.handle('db:addUsuario', (_e, nombre, usuario, pin, rol) => {
  const existing = db.prepare('SELECT id FROM usuario WHERE usuario = ?').get(usuario)
  if (existing) throw new Error('El nombre de usuario ya existe')
  const pinHash = crypto.createHash('sha256').update(pin).digest('hex')
  return db.prepare(
    'INSERT INTO usuario (nombre, usuario, pin, rol) VALUES (?, ?, ?, ?)'
  ).run(nombre, usuario, pinHash, rol)
})

ipcMain.handle('db:updateUsuario', (_e, id, nombre, usuario, pin, rol) => {
  // Verify username uniqueness (excluding current user)
  const existing = db.prepare('SELECT id FROM usuario WHERE usuario = ? AND id != ?').get(usuario, id)
  if (existing) throw new Error('El nombre de usuario ya existe')
  if (pin) {
    const pinHash = crypto.createHash('sha256').update(pin).digest('hex')
    return db.prepare(
      'UPDATE usuario SET nombre=?, usuario=?, pin=?, rol=? WHERE id=?'
    ).run(nombre, usuario, pinHash, rol, id)
  } else {
    return db.prepare(
      'UPDATE usuario SET nombre=?, usuario=?, rol=? WHERE id=?'
    ).run(nombre, usuario, rol, id)
  }
})

ipcMain.handle('db:toggleUsuario', (_e, id, activo) => {
  return db.prepare('UPDATE usuario SET activo=? WHERE id=?').run(activo, id)
})

// Configuración
ipcMain.handle('db:getConfiguracion', () => {
  return db.prepare('SELECT * FROM configuracion WHERE id = 1').get() || {
    id: 1,
    descuento_activo: 1,
    descuento_monto: 500,
    descuento_porcentaje: 10
  }
})

ipcMain.handle('db:updateConfiguracion', (_e, descuentoActivo, descuentoMonto, descuentoPorcentaje) => {
  return db.prepare(
    'UPDATE configuracion SET descuento_activo=?, descuento_monto=?, descuento_porcentaje=? WHERE id=1'
  ).run(descuentoActivo ? 1 : 0, descuentoMonto, descuentoPorcentaje)
})

ipcMain.handle('db:getDescuentosReglas', () => {
  return db.prepare('SELECT * FROM descuento_regla ORDER BY id ASC').all()
})

ipcMain.handle('db:addDescuentoRegla', (_e, nombre, montoMinimo, porcentaje, activo) => {
  return db.prepare(
    'INSERT INTO descuento_regla (nombre, monto_minimo, porcentaje, activo) VALUES (?, ?, ?, ?)'
  ).run(nombre || 'Nueva regla', montoMinimo, porcentaje, activo ? 1 : 0)
})

ipcMain.handle('db:updateDescuentoRegla', (_e, id, nombre, montoMinimo, porcentaje, activo) => {
  return db.prepare(
    'UPDATE descuento_regla SET nombre=?, monto_minimo=?, porcentaje=?, activo=? WHERE id=?'
  ).run(nombre, montoMinimo, porcentaje, activo ? 1 : 0, id)
})

ipcMain.handle('db:setDescuentoReglaActivo', (_e, id, activo) => {
  return db.prepare('UPDATE descuento_regla SET activo=? WHERE id=?').run(activo ? 1 : 0, id)
})

ipcMain.handle('db:deleteDescuentoRegla', (_e, id) => {
  return db.prepare('DELETE FROM descuento_regla WHERE id=?').run(id)
})

// Corte de caja (cierre diario)
ipcMain.handle('db:getResumenCorteCajaDia', (_e, fechaDia) => {
  const rows = db.prepare(`
    SELECT metodo_pago, COUNT(*) AS cnt, COALESCE(SUM(total), 0) AS suma
    FROM venta
    WHERE date(fecha) = date(?)
    GROUP BY metodo_pago
  `).all(fechaDia)

  let ventasEfectivo = 0
  let ventasTarjeta = 0
  let ventasTransferencia = 0
  let numVentas = 0
  let totalVentas = 0

  for (const r of rows) {
    numVentas += r.cnt
    totalVentas += r.suma
    if (r.metodo_pago === 'efectivo') ventasEfectivo += r.suma
    else if (r.metodo_pago === 'tarjeta') ventasTarjeta += r.suma
    else if (r.metodo_pago === 'transferencia') ventasTransferencia += r.suma
  }

  return {
    fecha: fechaDia,
    ventasEfectivo,
    ventasTarjeta,
    ventasTransferencia,
    totalVentas,
    numVentas
  }
})

ipcMain.handle('db:registrarCierreCaja', (_e, payload) => {
  const {
    fechaOperacion,
    usuarioId,
    ventasEfectivo,
    ventasTarjeta,
    ventasTransferencia,
    totalVentas,
    numVentas,
    efectivoContado,
    notas
  } = payload

  const contado = Number(efectivoContado)
  const ve = Number(ventasEfectivo) || 0
  const diferencia = contado - ve

  return db.prepare(`
    INSERT INTO cierre_caja (
      fecha_operacion, usuario_id,
      ventas_efectivo, ventas_tarjeta, ventas_transferencia,
      total_ventas, num_ventas, efectivo_contado, diferencia, notas
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    fechaOperacion,
    usuarioId || null,
    ve,
    Number(ventasTarjeta) || 0,
    Number(ventasTransferencia) || 0,
    Number(totalVentas) || 0,
    Number(numVentas) || 0,
    contado,
    diferencia,
    notas || null
  )
})

ipcMain.handle('db:getCierresCaja', (_e, limite) => {
  const n = Math.min(Math.max(parseInt(limite, 10) || 30, 1), 200)
  return db.prepare(`
    SELECT c.*, u.nombre AS usuario_nombre
    FROM cierre_caja c
    LEFT JOIN usuario u ON u.id = c.usuario_id
    ORDER BY c.fecha_cierre DESC
    LIMIT ?
  `).all(n)
})

// ── Corte de caja (sesiones, movimientos, X/Z) ──
ipcMain.handle('db:cajaAutorizarGerente', (_e, usuario, pin) => {
  const pinHash = crypto.createHash('sha256').update(String(pin)).digest('hex')
  const u = db.prepare(
    'SELECT id, nombre, rol, usuario FROM usuario WHERE usuario = ? AND pin = ? AND activo = 1'
  ).get(usuario, pinHash)
  if (!u || (u.rol !== 'admin' && u.rol !== 'gerente')) {
    throw new Error('Autorización denegada: se requiere usuario gerente o administrador')
  }
  return { id: u.id, nombre: u.nombre, rol: u.rol, usuario: u.usuario }
})

ipcMain.handle('db:cajaAbrir', (_e, usuarioId, cajaId, fondoInicial) => {
  return cajaService.abrirCaja(usuarioId, cajaId, fondoInicial)
})

ipcMain.handle('db:cajaSesionAbierta', (_e, cajaId) => {
  return cajaService.getSesionAbiertaPorCaja(cajaId)
})

ipcMain.handle('db:cajaResumen', (_e, sesionId) => {
  return cajaService.calcularResumenSesion(sesionId)
})

ipcMain.handle('db:cajaRegistrarMovimiento', (_e, sesionId, tipo, formaPago, monto, referencia, usuarioId) => {
  return cajaService.registrarMovimiento(sesionId, tipo, formaPago, monto, referencia, usuarioId)
})

ipcMain.handle('db:cajaRegistrarRetiro', (_e, payload) => {
  const { sesionId, monto, motivo, usuarioId, autorizadoPorId } = payload
  return cajaService.registrarRetiro(sesionId, monto, motivo, usuarioId, autorizadoPorId)
})

ipcMain.handle('db:cajaRegistrarIngreso', (_e, payload) => {
  const { sesionId, monto, motivo, usuarioId, autorizadoPorId } = payload
  return cajaService.registrarIngreso(sesionId, monto, motivo, usuarioId, autorizadoPorId)
})

ipcMain.handle('db:cajaCorteX', (_e, sesionId, usuarioId) => {
  return cajaService.corteParcialX(sesionId, usuarioId)
})

ipcMain.handle('db:cajaCorteZ', (_e, sesionId, efectivoContado, usuarioId) => {
  return cajaService.corteTotalZ(sesionId, efectivoContado, usuarioId)
})

ipcMain.handle('db:cajaTicket', (_e, corteId) => {
  return cajaService.generarTicketCorte(corteId)
})

ipcMain.handle('db:cajaMovimientos', (_e, sesionId, limite) => {
  return cajaService.listarMovimientosSesion(sesionId, limite)
})

ipcMain.handle('db:cajaUltimosCortesZ', (_e, limite) => {
  return cajaService.ultimosCortesZ(limite)
})

ipcMain.handle('db:cajaRegistrarVenta', (_e, folio, total, metodoPago, notas, sesionId, usuarioId) => {
  return cajaService.registrarVentaEnSesion(folio, total, metodoPago, notas, sesionId, usuarioId)
})

ipcMain.handle('db:cajaCancelarVenta', (_e, ventaId, usuarioId) => {
  return cajaService.cancelarVentaEnSesion(ventaId, usuarioId)
})

// Ventas
ipcMain.handle('db:addVenta', (_e, folio, total, metodo_pago, notas) => {
  return db.prepare(
    'INSERT INTO venta (folio, total, metodo_pago, notas) VALUES (?, ?, ?, ?)'
  ).run(folio, total, metodo_pago, notas)
})

ipcMain.handle('db:getVentas', () => {
  return db.prepare('SELECT * FROM venta ORDER BY fecha DESC').all()
})

// Detalle de venta
ipcMain.handle('db:addDetalle', (_e, venta_id, producto_id, cantidad, precio_unitario, subtotal) => {
  return db.prepare(
    'INSERT INTO detalle_venta (venta_id, producto_id, cantidad, precio_unitario, subtotal) VALUES (?, ?, ?, ?, ?)'
  ).run(venta_id, producto_id, cantidad, precio_unitario, subtotal)
})

ipcMain.handle('db:getDetalleVenta', (_e, venta_id) => {
  return db.prepare(
    'SELECT dv.*, p.nombre FROM detalle_venta dv JOIN producto p ON dv.producto_id = p.id WHERE dv.venta_id = ?'
  ).all(venta_id)
})

// Movimientos de inventario
ipcMain.handle('db:addMovimiento', (_e, producto_id, tipo, cantidad, motivo) => {
  return db.prepare(
    'INSERT INTO movimiento_inventario (producto_id, tipo, cantidad, motivo) VALUES (?, ?, ?, ?)'
  ).run(producto_id, tipo, cantidad, motivo)
})

// Compras
ipcMain.handle('db:addCompra', (_e, folio, proveedor, total, notas) => {
  return db.prepare(
    'INSERT INTO compra (folio, proveedor, total, notas) VALUES (?, ?, ?, ?)'
  ).run(folio, proveedor, total, notas)
})

ipcMain.handle('db:getCompras', () => {
  return db.prepare('SELECT * FROM compra ORDER BY fecha DESC').all()
})

ipcMain.handle('db:addDetalleCompra', (_e, compra_id, producto_id, cantidad, precio_unitario, subtotal) => {
  return db.prepare(
    'INSERT INTO detalle_compra (compra_id, producto_id, cantidad, precio_unitario, subtotal) VALUES (?, ?, ?, ?, ?)'
  ).run(compra_id, producto_id, cantidad, precio_unitario, subtotal)
})

ipcMain.handle('db:getDetalleCompra', (_e, compra_id) => {
  return db.prepare(
    'SELECT dc.*, p.nombre FROM detalle_compra dc JOIN producto p ON dc.producto_id = p.id WHERE dc.compra_id = ?'
  ).all(compra_id)
})

ipcMain.handle('db:confirmarCompra', (_e, compra_id) => {
  try {
    const detalles = db.prepare('SELECT * FROM detalle_compra WHERE compra_id = ?').all(compra_id)

    detalles.forEach(det => {
      // Actualizar stock
      const producto = db.prepare('SELECT stock FROM producto WHERE id = ?').get(det.producto_id)
      const nuevoStock = producto.stock + det.cantidad
      db.prepare('UPDATE producto SET stock = ? WHERE id = ?').run(nuevoStock, det.producto_id)

      // Registrar movimiento
      db.prepare(
        'INSERT INTO movimiento_inventario (producto_id, tipo, cantidad, motivo) VALUES (?, ?, ?, ?)'
      ).run(det.producto_id, 'entrada', det.cantidad, `Compra confirmada`)
    })

    // Actualizar estado de compra
    db.prepare("UPDATE compra SET estado = 'recibida', fecha_recepcion = datetime('now') WHERE id = ?").run(compra_id)

    return { success: true }
  } catch (err) {
    return { success: false, error: err.message }
  }
})

// ──────────────────────────────────────
// Métricas
// ──────────────────────────────────────

ipcMain.handle('db:getMetricas', (_e, fechaInicio, fechaFin) => {
  try {
    // Total ventas
    const ventasTotal = db.prepare(
      `SELECT COALESCE(SUM(total), 0) as total, COUNT(*) as count
       FROM venta WHERE fecha >= ? AND fecha <= ?`
    ).get(fechaInicio, fechaFin)

    // Total compras (gastos)
    const comprasTotal = db.prepare(
      `SELECT COALESCE(SUM(total), 0) as total, COUNT(*) as count
       FROM compra WHERE fecha >= ? AND fecha <= ? AND estado != 'cancelada'`
    ).get(fechaInicio, fechaFin)

    // Ganancia bruta = ventas - costo de los productos vendidos
    // Usamos el costo de compra promedio por producto
    const ganancia = ventasTotal.total - comprasTotal.total

    // Ticket promedio
    const ticketPromedio = ventasTotal.count > 0 ? ventasTotal.total / ventasTotal.count : 0

    // Productos en stock bajo
    const stockBajo = db.prepare(
      `SELECT COUNT(*) as count FROM producto WHERE stock <= stock_minimo AND stock > 0`
    ).get()

    // Productos sin stock
    const sinStock = db.prepare(
      `SELECT COUNT(*) as count FROM producto WHERE stock = 0`
    ).get()

    // Total productos
    const totalProductos = db.prepare(
      `SELECT COUNT(*) as count FROM producto`
    ).get()

    // Valor del inventario (stock * precio)
    const valorInventario = db.prepare(
      `SELECT COALESCE(SUM(stock * precio), 0) as total FROM producto`
    ).get()

    return {
      ventasTotal: ventasTotal.total,
      ventasCount: ventasTotal.count,
      comprasTotal: comprasTotal.total,
      comprasCount: comprasTotal.count,
      ganancia,
      ticketPromedio,
      stockBajo: stockBajo.count,
      sinStock: sinStock.count,
      totalProductos: totalProductos.count,
      valorInventario: valorInventario.total
    }
  } catch (err) {
    console.error('Error getMetricas:', err)
    return null
  }
})

ipcMain.handle('db:getVentasPorDia', (_e, fechaInicio, fechaFin) => {
  try {
    return db.prepare(
      `SELECT date(fecha) as dia, SUM(total) as total, COUNT(*) as count
       FROM venta WHERE fecha >= ? AND fecha <= ?
       GROUP BY date(fecha) ORDER BY dia ASC`
    ).all(fechaInicio, fechaFin)
  } catch (err) {
    console.error('Error getVentasPorDia:', err)
    return []
  }
})

ipcMain.handle('db:getComprasPorDia', (_e, fechaInicio, fechaFin) => {
  try {
    return db.prepare(
      `SELECT date(fecha) as dia, SUM(total) as total, COUNT(*) as count
       FROM compra WHERE fecha >= ? AND fecha <= ? AND estado != 'cancelada'
       GROUP BY date(fecha) ORDER BY dia ASC`
    ).all(fechaInicio, fechaFin)
  } catch (err) {
    console.error('Error getComprasPorDia:', err)
    return []
  }
})

ipcMain.handle('db:getProductosMasVendidos', (_e, fechaInicio, fechaFin, limite) => {
  try {
    return db.prepare(
      `SELECT p.nombre, p.tipo, SUM(dv.cantidad) as unidades, SUM(dv.subtotal) as ingresos
       FROM detalle_venta dv
       JOIN producto p ON dv.producto_id = p.id
       JOIN venta v ON dv.venta_id = v.id
       WHERE v.fecha >= ? AND v.fecha <= ?
       GROUP BY dv.producto_id
       ORDER BY unidades DESC
       LIMIT ?`
    ).all(fechaInicio, fechaFin, limite || 5)
  } catch (err) {
    console.error('Error getProductosMasVendidos:', err)
    return []
  }
})

ipcMain.handle('db:getVentasPorMetodo', (_e, fechaInicio, fechaFin) => {
  try {
    return db.prepare(
      `SELECT metodo_pago, COUNT(*) as count, SUM(total) as total
       FROM venta WHERE fecha >= ? AND fecha <= ?
       GROUP BY metodo_pago`
    ).all(fechaInicio, fechaFin)
  } catch (err) {
    console.error('Error getVentasPorMetodo:', err)
    return []
  }
})

// ──────────────────────────────────────
// Ventana principal
// ──────────────────────────────────────

const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  })

  mainWindow.loadFile(path.join(__dirname, 'renderer/index.html'))
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools()
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

app.whenReady().then(() => {
  insertarProductosDePrueba()
  createWindow()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (mainWindow === null) createWindow()
})
