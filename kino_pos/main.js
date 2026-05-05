const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('path')
const db = require('./database/db')

let mainWindow

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
  mainWindow.webContents.openDevTools() // Temporal para debugging

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (mainWindow === null) createWindow()
})
