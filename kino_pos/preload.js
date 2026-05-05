const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('db', {

  // Productos
  getProductos: () => ipcRenderer.invoke('db:getProductos'),

  addProducto: (nombre, tipo, precio, stock, stock_minimo) =>
    ipcRenderer.invoke('db:addProducto', nombre, tipo, precio, stock, stock_minimo),

  updateStock: (id, stock) =>
    ipcRenderer.invoke('db:updateStock', id, stock),

  // Ventas
  addVenta: (folio, total, metodo_pago, notas) =>
    ipcRenderer.invoke('db:addVenta', folio, total, metodo_pago, notas),

  getVentas: () => ipcRenderer.invoke('db:getVentas'),

  // Detalle de venta
  addDetalle: (venta_id, producto_id, cantidad, precio_unitario, subtotal) =>
    ipcRenderer.invoke('db:addDetalle', venta_id, producto_id, cantidad, precio_unitario, subtotal),

  getDetalleVenta: (venta_id) =>
    ipcRenderer.invoke('db:getDetalleVenta', venta_id),

  // Movimientos de inventario
  addMovimiento: (producto_id, tipo, cantidad, motivo) =>
    ipcRenderer.invoke('db:addMovimiento', producto_id, tipo, cantidad, motivo),

  // Compras
  addCompra: (folio, proveedor, total, notas) =>
    ipcRenderer.invoke('db:addCompra', folio, proveedor, total, notas),

  getCompras: () => ipcRenderer.invoke('db:getCompras'),

  addDetalleCompra: (compra_id, producto_id, cantidad, precio_unitario, subtotal) =>
    ipcRenderer.invoke('db:addDetalleCompra', compra_id, producto_id, cantidad, precio_unitario, subtotal),

  getDetalleCompra: (compra_id) =>
    ipcRenderer.invoke('db:getDetalleCompra', compra_id),

  confirmarCompra: (compra_id) =>
    ipcRenderer.invoke('db:confirmarCompra', compra_id),
})