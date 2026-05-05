const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('path')
const db = require('./database/db')

let mainWindow

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

ipcMain.handle('db:addProducto', (_e, nombre, tipo, precio, stock, stock_minimo) => {
  return db.prepare(
    'INSERT INTO producto (nombre, tipo, precio, stock, stock_minimo) VALUES (?, ?, ?, ?, ?)'
  ).run(nombre, tipo, precio, stock, stock_minimo)
})

ipcMain.handle('db:updateStock', (_e, id, stock) => {
  return db.prepare('UPDATE producto SET stock = ? WHERE id = ?').run(stock, id)
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
