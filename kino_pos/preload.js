const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('db', {

  // Auth & Usuarios
  getUsuariosActivos: () => ipcRenderer.invoke('db:getUsuariosActivos'),
  login: (usuario, pin) => ipcRenderer.invoke('db:login', usuario, pin),
  getUsuarios: () => ipcRenderer.invoke('db:getUsuarios'),
  addUsuario: (nombre, usuario, pin, rol) => ipcRenderer.invoke('db:addUsuario', nombre, usuario, pin, rol),
  updateUsuario: (id, nombre, usuario, pin, rol) => ipcRenderer.invoke('db:updateUsuario', id, nombre, usuario, pin, rol),
  toggleUsuario: (id, activo) => ipcRenderer.invoke('db:toggleUsuario', id, activo),

  getConfiguracion: () => ipcRenderer.invoke('db:getConfiguracion'),
  updateConfiguracion: (descuentoActivo, descuentoMonto, descuentoPorcentaje) =>
    ipcRenderer.invoke('db:updateConfiguracion', descuentoActivo, descuentoMonto, descuentoPorcentaje),

  getDescuentosReglas: () => ipcRenderer.invoke('db:getDescuentosReglas'),
  addDescuentoRegla: (nombre, montoMinimo, porcentaje, activo) =>
    ipcRenderer.invoke('db:addDescuentoRegla', nombre, montoMinimo, porcentaje, activo),
  updateDescuentoRegla: (id, nombre, montoMinimo, porcentaje, activo) =>
    ipcRenderer.invoke('db:updateDescuentoRegla', id, nombre, montoMinimo, porcentaje, activo),
  setDescuentoReglaActivo: (id, activo) =>
    ipcRenderer.invoke('db:setDescuentoReglaActivo', id, activo),
  deleteDescuentoRegla: (id) => ipcRenderer.invoke('db:deleteDescuentoRegla', id),

  // Productos
  getProductos: () => ipcRenderer.invoke('db:getProductos'),

  addProducto: (nombre, tipo, precio, stock, stock_minimo, imagen) =>
    ipcRenderer.invoke('db:addProducto', nombre, tipo, precio, stock, stock_minimo, imagen),

  updateStock: (id, stock) =>
    ipcRenderer.invoke('db:updateStock', id, stock),

  updateProducto: (id, nombre, tipo, precio, stock, stock_minimo, imagen) =>
    ipcRenderer.invoke('db:updateProducto', id, nombre, tipo, precio, stock, stock_minimo, imagen),

  // Imágenes
  selectImage: () => ipcRenderer.invoke('dialog:selectImage'),
  saveImage: (sourcePath) => ipcRenderer.invoke('image:save', sourcePath),
  getImagePath: (filename) => ipcRenderer.invoke('image:getPath', filename),

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

  // Métricas
  getMetricas: (fechaInicio, fechaFin) =>
    ipcRenderer.invoke('db:getMetricas', fechaInicio, fechaFin),

  getVentasPorDia: (fechaInicio, fechaFin) =>
    ipcRenderer.invoke('db:getVentasPorDia', fechaInicio, fechaFin),

  getComprasPorDia: (fechaInicio, fechaFin) =>
    ipcRenderer.invoke('db:getComprasPorDia', fechaInicio, fechaFin),

  getProductosMasVendidos: (fechaInicio, fechaFin, limite) =>
    ipcRenderer.invoke('db:getProductosMasVendidos', fechaInicio, fechaFin, limite),

  getVentasPorMetodo: (fechaInicio, fechaFin) =>
    ipcRenderer.invoke('db:getVentasPorMetodo', fechaInicio, fechaFin),
})