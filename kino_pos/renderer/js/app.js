// Estado del carrito
let carrito = []
let metodoSeleccionado = 'efectivo'
let tabActual = 'catalogo'

// Inicializar la app
document.addEventListener('DOMContentLoaded', async () => {
  actualizarFecha()
  await cargarProductos()

  // Event listeners para filtros
  document.querySelectorAll('[data-filter]').forEach(btn => {
    btn.addEventListener('click', (e) => filtrarProductos(e.target.dataset.filter, e.target))
  })

  // Search
  document.getElementById('search').addEventListener('input', (e) => buscarProductos(e.target.value))

  // Navigation tabs
  document.querySelectorAll('.nav-tab').forEach(btn => {
    btn.addEventListener('click', () => cambiarTab(btn.dataset.tab, btn))
  })

  // Payment methods
  document.querySelectorAll('[data-metodo]').forEach(btn => {
    btn.addEventListener('click', () => seleccionarMetodo(btn.dataset.metodo, btn))
  })

  // Cart
  document.getElementById('btn-cobrar').addEventListener('click', cobrar)
  document.getElementById('btn-limpiar-carrito').addEventListener('click', limpiarCarrito)

  // Inventario
  document.getElementById('btn-agregar-producto').addEventListener('click', mostrarModalAgregarProducto)
  document.getElementById('btn-cancelar-producto').addEventListener('click', () => cerrarModal('modal-agregar-producto'))
  document.getElementById('btn-submit-producto').addEventListener('click', submitAgregarProducto)

  // Compras
  document.getElementById('btn-nueva-compra').addEventListener('click', mostrarModalNuevaCompra)
  document.getElementById('btn-cancelar-compra').addEventListener('click', () => cerrarModal('modal-nueva-compra'))
  document.getElementById('btn-compra-siguiente').addEventListener('click', siguientePasoCompra)
  document.getElementById('btn-agregar-item-compra').addEventListener('click', agregarItemCompra)

  // Modales genéricos
  document.getElementById('btn-alerta-ok').addEventListener('click', cerrarAlerta)
  document.getElementById('btn-confirmar-si').addEventListener('click', () => resolverConfirm(true))
  document.getElementById('btn-confirmar-no').addEventListener('click', () => resolverConfirm(false))
  document.getElementById('btn-cerrar-detalle').addEventListener('click', () => cerrarModal('modal-detalle'))
})

function actualizarFecha() {
  const ahora = new Date()
  const opciones = { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' }
  document.getElementById('fecha').textContent = 'Hoy: ' + ahora.toLocaleDateString('es-ES', opciones)
}

async function cargarProductos() {
  try {
    const productos = await window.db.getProductos()
    mostrarProductos(productos)
  } catch (err) {
    console.error('Error cargando productos:', err)
  }
}

function mostrarProductos(productos) {
  const container = document.getElementById('productos-container')
  container.innerHTML = ''

  // Agrupar por tipo
  const gorras = productos.filter(p => p.tipo === 'gorra')
  const playeras = productos.filter(p => p.tipo === 'playera')

  if (gorras.length > 0) {
    container.appendChild(crearSeccion('GORRAS', gorras))
  }
  if (playeras.length > 0) {
    container.appendChild(crearSeccion('PLAYERAS', playeras))
  }
}

function crearSeccion(titulo, productos) {
  const section = document.createElement('section')
  section.className = 'mb-10'

  const titulo_el = document.createElement('h3')
  titulo_el.className = 'font-h2 text-h2 text-outline mb-4 tracking-widest uppercase'
  titulo_el.textContent = titulo
  section.appendChild(titulo_el)

  const grid = document.createElement('div')
  grid.className = 'grid grid-cols-4 gap-gutter'

  productos.forEach(producto => {
    grid.appendChild(crearCard(producto))
  })

  section.appendChild(grid)
  return section
}

function crearCard(producto) {
  const card = document.createElement('div')
  card.className = 'product-card-hover group relative bg-white rounded-xl border border-outline-variant p-4 transition-all hover:border-primary-container cursor-pointer'

  // Stock badge color
  let badgeClass = 'bg-[#E8F5F1] text-[#1D9E75]'
  if (producto.stock <= 5 && producto.stock > 0) {
    badgeClass = 'bg-yellow-100 text-yellow-700'
  } else if (producto.stock === 0) {
    badgeClass = 'bg-error-container text-error'
  }

  const stock = producto.stock > 0 ? `${producto.stock} Stock` : 'Sin stock'

  card.innerHTML = `
    <span class="absolute top-3 right-3 px-2 py-1 ${badgeClass} font-label-sm text-label-sm rounded-full">${stock}</span>
    <div class="w-full aspect-square bg-gray-50 rounded-lg flex items-center justify-center mb-3">
      <span class="text-4xl">${producto.tipo === 'gorra' ? '🧢' : '👕'}</span>
    </div>
    <p class="font-code-num text-code-num text-outline mb-1">#${producto.id}</p>
    <p class="font-body-m-bold text-body-m mb-1">${producto.nombre}</p>
    <p class="font-h2 text-h2 text-[#1D9E75]">$${producto.precio.toFixed(2)}</p>
    <div class="hover-overlay opacity-0 absolute inset-0 bg-[#1D9E75]/10 rounded-xl flex items-center justify-center transition-opacity">
      <div class="w-10 h-10 bg-[#1D9E75] text-white rounded-full flex items-center justify-center">
        <span class="material-symbols-outlined">add</span>
      </div>
    </div>
  `

  if (producto.stock > 0) {
    card.addEventListener('click', () => agregarAlCarrito(producto))
  } else {
    card.style.opacity = '0.5'
    card.style.pointerEvents = 'none'
  }

  return card
}

function agregarAlCarrito(producto) {
  const existente = carrito.find(item => item.id === producto.id)

  if (existente) {
    existente.cantidad++
  } else {
    carrito.push({
      ...producto,
      cantidad: 1
    })
  }

  actualizarCarrito()
}

function actualizarCarrito() {
  const container = document.getElementById('carrito-items')

  if (carrito.length === 0) {
    container.innerHTML = '<p class="text-center text-outline py-8">Carrito vacío</p>'
    document.getElementById('carrito-count').textContent = '0 ítems'
    actualizarTotales()
    return
  }

  container.innerHTML = carrito.map((item, idx) => `
    <div class="flex items-center gap-3 group">
      <div class="w-12 h-12 bg-gray-50 rounded-lg flex items-center justify-center border border-gray-100">
        <span class="text-xl">${item.tipo === 'gorra' ? '🧢' : '👕'}</span>
      </div>
      <div class="flex-1">
        <p class="font-body-m-bold text-body-m line-clamp-1">${item.nombre}</p>
        <p class="font-code-num text-code-num text-[#1D9E75]">$${item.precio.toFixed(2)}</p>
      </div>
      <div class="flex items-center gap-1 border border-outline-variant rounded-lg p-1">
        <button class="w-8 h-8 flex items-center justify-center hover:bg-gray-100 rounded transition-colors" onclick="cambiarCantidad(${idx}, -1)">−</button>
        <span class="w-8 text-center font-body-m-bold">${item.cantidad}</span>
        <button class="w-8 h-8 flex items-center justify-center hover:bg-gray-100 rounded transition-colors" onclick="cambiarCantidad(${idx}, 1)">+</button>
      </div>
    </div>
  `).join('')

  document.getElementById('carrito-count').textContent = `${carrito.length} ítems`
  actualizarTotales()
}

function cambiarCantidad(idx, delta) {
  carrito[idx].cantidad += delta
  if (carrito[idx].cantidad <= 0) {
    carrito.splice(idx, 1)
  }
  actualizarCarrito()
}

function limpiarCarrito() {
  carrito = []
  actualizarCarrito()
}

function actualizarTotales() {
  const subtotal = carrito.reduce((sum, item) => sum + (item.precio * item.cantidad), 0)
  const descuento = subtotal > 500 ? subtotal * 0.1 : 0
  const total = subtotal - descuento

  document.getElementById('subtotal').textContent = `$${subtotal.toFixed(2)}`
  document.getElementById('descuento').textContent = `-$${descuento.toFixed(2)}`
  document.getElementById('total').textContent = `$${total.toFixed(2)}`
  document.getElementById('btn-cobrar').textContent = `Cobrar $${total.toFixed(2)}`
}

function seleccionarMetodo(metodo, button) {
  metodoSeleccionado = metodo

  // Actualizar estilos
  document.querySelectorAll('[data-metodo]').forEach(btn => {
    btn.classList.remove('border-2', 'border-[#1D9E75]', 'bg-[#E8F5F1]', 'text-[#1D9E75]')
    btn.classList.add('border', 'border-outline-variant', 'hover:bg-gray-50', 'text-outline')
  })

  button.classList.remove('border', 'border-outline-variant', 'hover:bg-gray-50', 'text-outline')
  button.classList.add('border-2', 'border-[#1D9E75]', 'bg-[#E8F5F1]', 'text-[#1D9E75]')
}

async function cobrar() {
  if (carrito.length === 0) {
    await mostrarAlerta('El carrito está vacío')
    return
  }

  try {
    const folio = 'V' + Date.now().toString().slice(-8)
    const subtotal = carrito.reduce((sum, item) => sum + (item.precio * item.cantidad), 0)
    const descuento = subtotal > 500 ? subtotal * 0.1 : 0
    const total = subtotal - descuento

    // Crear venta
    await window.db.addVenta(folio, total, metodoSeleccionado, '')

    // Obtener el ID de la venta
    const ventas = await window.db.getVentas()
    const ventaId = ventas[0].id

    // Agregar detalles y actualizar stock
    for (const item of carrito) {
      const subtotal = item.precio * item.cantidad
      await window.db.addDetalle(ventaId, item.id, item.cantidad, item.precio, subtotal)
      await window.db.updateStock(item.id, item.stock - item.cantidad)
      await window.db.addMovimiento(item.id, 'venta', item.cantidad, `Venta ${folio}`)
    }

    // Éxito
    await mostrarAlerta(`✓ Venta completada\nFolio: ${folio}\nTotal: $${total.toFixed(2)}`)
    limpiarCarrito()
    await cargarProductos()
  } catch (err) {
    await mostrarAlerta('Error al completar la venta: ' + err.message)
    console.error(err)
  }
}

function filtrarProductos(tipo, button) {
  // Actualizar botón activo
  document.querySelectorAll('[data-filter]').forEach(btn => {
    if (btn === button) {
      btn.classList.remove('bg-white', 'text-on-surface', 'border-outline-variant', 'hover:bg-gray-50')
      btn.classList.add('bg-[#1D9E75]', 'text-white', 'border-[#1D9E75]')
    } else {
      btn.classList.remove('bg-[#1D9E75]', 'text-white', 'border-[#1D9E75]')
      btn.classList.add('bg-white', 'text-on-surface', 'border-outline-variant', 'hover:bg-gray-50')
    }
  })

  // Filtrar productos
  const items = document.querySelectorAll('[data-filter]')
  cargarProductos() // Recargar y filtrar
}

function buscarProductos(termino) {
  // Buscar en los cards
  const cards = document.querySelectorAll('.product-card-hover')
  cards.forEach(card => {
    const nombre = card.querySelector('.font-body-m-bold')?.textContent || ''
    const id = card.querySelector('.font-code-num')?.textContent || ''

    if (nombre.toLowerCase().includes(termino.toLowerCase()) ||
        id.toLowerCase().includes(termino.toLowerCase())) {
      card.style.display = 'block'
    } else {
      card.style.display = 'none'
    }
  })
}

// Funciones para cambio de tabs
function cambiarTab(tabNombre, button) {
  tabActual = tabNombre

  // Actualizar botones de navegación
  document.querySelectorAll('.nav-tab').forEach(btn => {
    btn.classList.remove('active')
  })
  button.classList.add('active')

  // Ocultar todos los tabs
  document.getElementById('tab-catalogo').classList.add('hidden')
  document.getElementById('tab-inventario').classList.add('hidden')
  document.getElementById('tab-compras').classList.add('hidden')
  document.getElementById('tab-historial').classList.add('hidden')

  // Mostrar el tab seleccionado
  document.getElementById(`tab-${tabNombre}`).classList.remove('hidden')

  // Mostrar/ocultar carrito según el tab
  const cartSidebar = document.getElementById('cart-sidebar')
  if (tabNombre === 'catalogo') {
    cartSidebar.style.display = 'flex'
  } else {
    cartSidebar.style.display = 'none'
    // Cargar contenido de los otros tabs
    if (tabNombre === 'inventario') {
      cargarInventario()
    } else if (tabNombre === 'compras') {
      cargarCompras()
    } else if (tabNombre === 'historial') {
      cargarHistorial()
    }
  }
}

async function cargarInventario() {
  try {
    const productos = await window.db.getProductos()
    mostrarInventario(productos)
  } catch (err) {
    console.error('Error cargando inventario:', err)
  }
}

function mostrarInventario(productos) {
  const container = document.getElementById('inventario-container')

  if (productos.length === 0) {
    container.innerHTML = '<p class="text-center text-outline py-8">No hay productos</p>'
    return
  }

  const tabla = document.createElement('div')
  tabla.className = 'space-y-2 pb-8'

  const header = document.createElement('div')
  header.className = 'grid grid-cols-6 gap-2 p-4 bg-surface-container-low rounded-lg font-body-m-bold sticky top-0'
  header.innerHTML = `
    <div>Producto</div>
    <div>Tipo</div>
    <div>Precio</div>
    <div>Stock</div>
    <div>Mín.</div>
    <div>Acción</div>
  `
  tabla.appendChild(header)

  productos.forEach(prod => {
    const row = document.createElement('div')
    row.className = 'grid grid-cols-6 gap-2 p-4 bg-white border border-outline-variant rounded-lg items-center'

    const stockClass = prod.stock > prod.stock_minimo ? 'text-green-600' : 'text-yellow-600'

    row.innerHTML = `
      <div class="font-body-m-bold">${prod.nombre}</div>
      <div class="text-body-m">${prod.tipo === 'gorra' ? '🧢' : '👕'}</div>
      <div class="text-body-m">$${prod.precio.toFixed(2)}</div>
      <div class="text-body-m ${stockClass}">${prod.stock}</div>
      <div class="text-body-m">${prod.stock_minimo}</div>
      <div class="flex gap-1">
        <input type="number" value="${prod.stock}" min="0" id="stock-${prod.id}" class="w-16 px-2 py-1 border border-outline-variant rounded text-sm" />
        <button onclick="actualizarStockInventario(${prod.id}, this)" class="px-2 py-1 bg-[#1D9E75] text-white rounded text-xs font-bold">Guardar</button>
      </div>
    `
    tabla.appendChild(row)
  })

  container.innerHTML = ''
  container.appendChild(tabla)
}

async function actualizarStockInventario(id, button) {
  const nuevoStock = parseInt(document.getElementById(`stock-${id}`).value)
  try {
    await window.db.updateStock(id, nuevoStock)
    button.textContent = '✓'
    button.disabled = true
    setTimeout(() => {
      button.textContent = 'Guardar'
      button.disabled = false
    }, 2000)
  } catch (err) {
    mostrarAlerta('Error actualizando stock: ' + err.message)
  }
}

async function cargarHistorial() {
  try {
    const ventas = await window.db.getVentas()
    mostrarHistorial(ventas)
  } catch (err) {
    console.error('Error cargando historial:', err)
  }
}

function mostrarHistorial(ventas) {
  const container = document.getElementById('historial-container')

  if (ventas.length === 0) {
    container.innerHTML = '<p class="text-center text-outline py-8">No hay ventas registradas</p>'
    return
  }

  const lista = document.createElement('div')
  lista.className = 'space-y-3 pb-8'

  ventas.forEach(venta => {
    const fecha = new Date(venta.fecha).toLocaleDateString('es-ES')
    const hora = new Date(venta.fecha).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })

    const card = document.createElement('div')
    card.className = 'p-4 bg-white border border-outline-variant rounded-xl hover:border-primary-container transition-all cursor-pointer'
    card.innerHTML = `
      <div class="flex justify-between items-start mb-2">
        <div>
          <p class="font-body-m-bold">Folio: ${venta.folio}</p>
          <p class="text-body-m text-outline">${fecha} ${hora}</p>
        </div>
        <div class="text-right">
          <p class="font-display-price text-h2 text-[#1D9E75]">$${venta.total.toFixed(2)}</p>
          <p class="text-label-sm text-outline">${venta.metodo_pago}</p>
        </div>
      </div>
    `
    card.addEventListener('click', () => verDetalleVenta(venta.id))
    lista.appendChild(card)
  })

  container.innerHTML = ''
  container.appendChild(lista)
}

async function verDetalleVenta(ventaId) {
  try {
    const detalle = await window.db.getDetalleVenta(ventaId)
    document.getElementById('detalle-titulo').textContent = 'Detalle de Venta'
    const total = detalle.reduce((sum, d) => sum + d.subtotal, 0)
    document.getElementById('detalle-contenido').innerHTML = detalle.map(d => `
      <div class="flex justify-between p-2 bg-gray-50 rounded">
        <span>${d.nombre} x${d.cantidad}</span>
        <span class="font-body-m-bold">$${d.subtotal.toFixed(2)}</span>
      </div>
    `).join('') + `<div class="flex justify-between pt-2 border-t font-h2 text-h2"><span>Total</span><span class="text-[#1D9E75]">$${total.toFixed(2)}</span></div>`
    abrirModal('modal-detalle')
  } catch (err) {
    console.error('Error cargando detalle:', err)
  }
}

// ═══════════════════════════════════════════════════════════════
// UTILIDADES DE MODALES (reemplazan prompt/confirm/alert)
// ═══════════════════════════════════════════════════════════════

function cerrarModal(id) {
  document.getElementById(id).classList.add('hidden')
}

function abrirModal(id) {
  document.getElementById(id).classList.remove('hidden')
}

// Alerta custom (reemplaza alert)
let _alertaResolve = null
function mostrarAlerta(texto) {
  return new Promise(resolve => {
    _alertaResolve = resolve
    document.getElementById('alerta-texto').textContent = texto
    abrirModal('modal-alerta')
  })
}
function cerrarAlerta() {
  cerrarModal('modal-alerta')
  if (_alertaResolve) { _alertaResolve(); _alertaResolve = null }
}

// Confirm custom (reemplaza confirm)
let _confirmResolve = null
function mostrarConfirm(texto) {
  return new Promise(resolve => {
    _confirmResolve = resolve
    document.getElementById('confirmar-texto').textContent = texto
    abrirModal('modal-confirmar')
  })
}
function resolverConfirm(valor) {
  cerrarModal('modal-confirmar')
  if (_confirmResolve) { _confirmResolve(valor); _confirmResolve = null }
}

// ═══════════════════════════════════════════════════════════════
// AGREGAR PRODUCTO (modal HTML)
// ═══════════════════════════════════════════════════════════════

function mostrarModalAgregarProducto() {
  // Reset form
  document.getElementById('input-prod-nombre').value = ''
  document.getElementById('input-prod-precio').value = ''
  document.getElementById('input-prod-stock').value = ''
  document.getElementById('input-prod-minimo').value = '5'
  document.querySelector('input[name="tipo-producto"][value="gorra"]').checked = true
  abrirModal('modal-agregar-producto')
}

async function submitAgregarProducto() {
  const nombre = document.getElementById('input-prod-nombre').value.trim()
  const tipo = document.querySelector('input[name="tipo-producto"]:checked').value
  const precio = parseFloat(document.getElementById('input-prod-precio').value)
  const stock = parseInt(document.getElementById('input-prod-stock').value)
  const stock_minimo = parseInt(document.getElementById('input-prod-minimo').value) || 5

  if (!nombre) { await mostrarAlerta('Ingresa el nombre del producto'); return }
  if (isNaN(precio) || precio <= 0) { await mostrarAlerta('Ingresa un precio válido'); return }
  if (isNaN(stock) || stock < 0) { await mostrarAlerta('Ingresa un stock válido'); return }

  try {
    await window.db.addProducto(nombre, tipo, precio, stock, stock_minimo)
    cerrarModal('modal-agregar-producto')
    await mostrarAlerta('✓ Producto agregado correctamente')
    await cargarInventario()
  } catch (err) {
    await mostrarAlerta('Error: ' + err.message)
  }
}

// ═══════════════════════════════════════════════════════════════
// COMPRAS (modal HTML multi-paso)
// ═══════════════════════════════════════════════════════════════

let compraActual = null
let detallesCompra = []
let productosDisponibles = []

async function cargarCompras() {
  try {
    const compras = await window.db.getCompras()
    mostrarCompras(compras)
  } catch (err) {
    console.error('Error cargando compras:', err)
  }
}

function mostrarCompras(compras) {
  const container = document.getElementById('compras-container')

  if (compras.length === 0) {
    container.innerHTML = '<p class="text-center text-outline py-8">No hay compras registradas</p>'
    return
  }

  const lista = document.createElement('div')
  lista.className = 'space-y-3 pb-8'

  compras.forEach(compra => {
    const fecha = new Date(compra.fecha).toLocaleDateString('es-ES')
    const estado = compra.estado === 'recibida' ? '✓ Recibida' : compra.estado === 'pendiente' ? '⏳ Pendiente' : '✗ Cancelada'
    const estadoColor = compra.estado === 'recibida' ? 'text-green-600' : compra.estado === 'pendiente' ? 'text-yellow-600' : 'text-red-600'

    const card = document.createElement('div')
    card.className = 'p-4 bg-white border border-outline-variant rounded-xl hover:border-primary-container transition-all'
    card.innerHTML = `
      <div class="flex justify-between items-start mb-2">
        <div>
          <p class="font-body-m-bold">Folio: ${compra.folio}</p>
          <p class="text-body-m text-outline">${compra.proveedor}</p>
          <p class="text-label-sm text-outline">${fecha}</p>
        </div>
        <div class="text-right">
          <p class="font-display-price text-h2 text-[#1D9E75]">$${compra.total.toFixed(2)}</p>
          <p class="text-label-sm ${estadoColor} font-bold">${estado}</p>
        </div>
      </div>
      <div class="flex gap-2">
        <button onclick="verDetalleCompra(${compra.id})" class="px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded text-xs">Ver detalle</button>
        ${compra.estado === 'pendiente' ? `<button onclick="confirmarCompra(${compra.id})" class="px-2 py-1 bg-green-500 text-white hover:bg-green-600 rounded text-xs">Recibir</button>` : ''}
      </div>
    `
    lista.appendChild(card)
  })

  container.innerHTML = ''
  container.appendChild(lista)
}

async function mostrarModalNuevaCompra() {
  // Reset
  document.getElementById('input-compra-proveedor').value = ''
  document.getElementById('input-compra-notas').value = ''
  document.getElementById('compra-paso-1').classList.remove('hidden')
  document.getElementById('compra-paso-2').classList.add('hidden')
  document.getElementById('btn-compra-siguiente').textContent = 'Siguiente'
  compraPaso2 = false
  detallesCompra = []
  compraActual = null
  actualizarListaCompra()

  // Cargar productos al select
  productosDisponibles = await window.db.getProductos()
  const select = document.getElementById('select-compra-producto')
  select.innerHTML = '<option value="">Seleccionar producto...</option>'
  productosDisponibles.forEach(p => {
    select.innerHTML += `<option value="${p.id}">${p.nombre} (${p.tipo})</option>`
  })

  abrirModal('modal-nueva-compra')
}

let compraPaso2 = false

function siguientePasoCompra() {
  if (compraPaso2) {
    submitCompra()
    return
  }

  const proveedor = document.getElementById('input-compra-proveedor').value.trim()
  if (!proveedor) { mostrarAlerta('Ingresa el nombre del proveedor'); return }

  compraActual = {
    folio: 'C' + Date.now().toString().slice(-8),
    proveedor
  }

  compraPaso2 = true
  document.getElementById('compra-paso-1').classList.add('hidden')
  document.getElementById('compra-paso-2').classList.remove('hidden')
  document.getElementById('btn-compra-siguiente').textContent = 'Guardar Compra'
}

function agregarItemCompra() {
  const select = document.getElementById('select-compra-producto')
  const productoId = parseInt(select.value)
  const costo = parseFloat(document.getElementById('input-compra-costo').value)
  const cantidad = parseInt(document.getElementById('input-compra-cantidad').value)

  if (!productoId) { mostrarAlerta('Selecciona un producto'); return }
  if (isNaN(costo) || costo <= 0) { mostrarAlerta('Ingresa el costo de compra'); return }
  if (isNaN(cantidad) || cantidad <= 0) { mostrarAlerta('Ingresa una cantidad válida'); return }

  const producto = productosDisponibles.find(p => p.id === productoId)
  if (!producto) return

  detallesCompra.push({
    producto_id: productoId,
    producto_nombre: producto.nombre,
    cantidad,
    precio_unitario: costo,
    subtotal: costo * cantidad
  })

  // Reset inputs
  select.value = ''
  document.getElementById('input-compra-costo').value = ''
  document.getElementById('input-compra-cantidad').value = '1'
  actualizarListaCompra()
}

function eliminarItemCompra(idx) {
  detallesCompra.splice(idx, 1)
  actualizarListaCompra()
}

function actualizarListaCompra() {
  const container = document.getElementById('lista-items-compra')
  const total = detallesCompra.reduce((sum, d) => sum + d.subtotal, 0)
  document.getElementById('total-compra').textContent = `$${total.toFixed(2)}`

  if (detallesCompra.length === 0) {
    container.innerHTML = '<p class="text-center text-outline text-sm py-4">Agrega productos a la compra</p>'
    return
  }

  container.innerHTML = detallesCompra.map((d, i) => `
    <div class="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
      <div>
        <span class="font-body-m-bold text-sm">${d.producto_nombre}</span>
        <span class="text-outline text-xs ml-2">x${d.cantidad} @ $${d.precio_unitario.toFixed(2)}</span>
      </div>
      <div class="flex items-center gap-2">
        <span class="font-body-m-bold text-sm text-[#1D9E75]">$${d.subtotal.toFixed(2)}</span>
        <button onclick="eliminarItemCompra(${i})" class="text-red-400 hover:text-red-600">
          <span class="material-symbols-outlined text-sm">close</span>
        </button>
      </div>
    </div>
  `).join('')
}

async function submitCompra() {
  if (detallesCompra.length === 0) {
    await mostrarAlerta('Agrega al menos un producto')
    return
  }

  const total = detallesCompra.reduce((sum, item) => sum + item.subtotal, 0)
  const notas = document.getElementById('input-compra-notas').value.trim()

  try {
    await window.db.addCompra(compraActual.folio, compraActual.proveedor, total, notas)

    const compras = await window.db.getCompras()
    const compraId = compras[0].id

    for (const item of detallesCompra) {
      await window.db.addDetalleCompra(compraId, item.producto_id, item.cantidad, item.precio_unitario, item.subtotal)
    }

    cerrarModal('modal-nueva-compra')
    await mostrarAlerta(`✓ Compra registrada\nFolio: ${compraActual.folio}\nTotal: $${total.toFixed(2)}`)
    compraActual = null
    detallesCompra = []
    await cargarCompras()
  } catch (err) {
    await mostrarAlerta('Error: ' + err.message)
  }
}

async function verDetalleCompra(compraId) {
  try {
    const detalle = await window.db.getDetalleCompra(compraId)
    document.getElementById('detalle-titulo').textContent = 'Detalle de Compra'
    const total = detalle.reduce((sum, d) => sum + d.subtotal, 0)
    document.getElementById('detalle-contenido').innerHTML = detalle.map(d => `
      <div class="flex justify-between p-2 bg-gray-50 rounded">
        <span>${d.nombre} x${d.cantidad}</span>
        <span class="font-body-m-bold">$${d.subtotal.toFixed(2)}</span>
      </div>
    `).join('') + `<div class="flex justify-between pt-2 border-t font-h2 text-h2"><span>Total</span><span class="text-[#1D9E75]">$${total.toFixed(2)}</span></div>`
    abrirModal('modal-detalle')
  } catch (err) {
    console.error('Error:', err)
  }
}

async function confirmarCompra(compraId) {
  const ok = await mostrarConfirm('¿Confirmar recepción de esta compra? El inventario será actualizado.')
  if (!ok) return

  try {
    const result = await window.db.confirmarCompra(compraId)
    if (result.success) {
      await mostrarAlerta('✓ Compra confirmada y inventario actualizado')
      await cargarCompras()
      await cargarInventario()
    } else {
      await mostrarAlerta('Error: ' + result.error)
    }
  } catch (err) {
    await mostrarAlerta('Error: ' + err.message)
  }
}

