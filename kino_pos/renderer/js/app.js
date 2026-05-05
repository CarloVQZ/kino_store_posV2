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

  // Métricas range buttons
  document.querySelectorAll('.metrics-range-btn').forEach(btn => {
    btn.addEventListener('click', () => seleccionarRangoMetricas(btn.dataset.range, btn))
  })
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
    if (existente.cantidad >= producto.stock) {
      mostrarAlerta(`Stock máximo alcanzado para "${producto.nombre}" (${producto.stock} disponibles)`)
      return
    }
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

  container.innerHTML = ''

  carrito.forEach((item, idx) => {
    const atMax = item.cantidad >= item.stock
    const row = document.createElement('div')
    row.className = 'flex items-center gap-3 group'
    row.innerHTML = `
      <div class="w-12 h-12 bg-gray-50 rounded-lg flex items-center justify-center border border-gray-100">
        <span class="text-xl">${item.tipo === 'gorra' ? '🧢' : '👕'}</span>
      </div>
      <div class="flex-1">
        <p class="font-body-m-bold text-body-m line-clamp-1">${item.nombre}</p>
        <p class="font-code-num text-code-num text-[#1D9E75]">$${item.precio.toFixed(2)}</p>
      </div>
      <div class="flex items-center gap-1 border border-outline-variant rounded-lg p-1">
        <button class="btn-qty-minus w-8 h-8 flex items-center justify-center hover:bg-gray-100 rounded transition-colors">−</button>
        <span class="w-8 text-center font-body-m-bold">${item.cantidad}</span>
        <button class="btn-qty-plus w-8 h-8 flex items-center justify-center rounded transition-colors ${atMax ? 'opacity-30 cursor-not-allowed' : 'hover:bg-gray-100'}">+</button>
      </div>
    `
    row.querySelector('.btn-qty-minus').addEventListener('click', () => cambiarCantidad(idx, -1))
    const btnPlus = row.querySelector('.btn-qty-plus')
    if (!atMax) {
      btnPlus.addEventListener('click', () => cambiarCantidad(idx, 1))
    }
    container.appendChild(row)
  })

  document.getElementById('carrito-count').textContent = `${carrito.length} ítems`
  actualizarTotales()
}

function cambiarCantidad(idx, delta) {
  const item = carrito[idx]
  const nuevaCantidad = item.cantidad + delta

  if (delta > 0 && nuevaCantidad > item.stock) {
    mostrarAlerta(`Stock máximo alcanzado para "${item.nombre}" (${item.stock} disponibles)`)
    return
  }

  item.cantidad = nuevaCantidad
  if (item.cantidad <= 0) {
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
  document.getElementById('tab-metricas').classList.add('hidden')

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
    } else if (tabNombre === 'metricas') {
      cargarMetricas()
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
        <button class="btn-guardar-stock px-2 py-1 bg-[#1D9E75] text-white rounded text-xs font-bold">Guardar</button>
      </div>
    `

    const btnGuardar = row.querySelector('.btn-guardar-stock')
    btnGuardar.addEventListener('click', function() {
      actualizarStockInventario(prod.id, this)
    })

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
      <div class="flex gap-2"></div>
    `

    // Usar addEventListener en vez de onclick (CSP bloquea inline handlers)
    const btnContainer = card.querySelector('.flex.gap-2:last-child')

    const btnDetalle = document.createElement('button')
    btnDetalle.className = 'px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded text-xs'
    btnDetalle.textContent = 'Ver detalle'
    btnDetalle.addEventListener('click', () => verDetalleCompra(compra.id))
    btnContainer.appendChild(btnDetalle)

    if (compra.estado === 'pendiente') {
      const btnRecibir = document.createElement('button')
      btnRecibir.className = 'px-2 py-1 bg-green-500 text-white hover:bg-green-600 rounded text-xs'
      btnRecibir.textContent = 'Recibir'
      btnRecibir.addEventListener('click', () => confirmarCompra(compra.id))
      btnContainer.appendChild(btnRecibir)
    }

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
  productoSeleccionadoCompra = null
  actualizarListaCompra()

  // Cargar productos
  productosDisponibles = await window.db.getProductos()

  // Reset picker
  resetProductoPicker()

  abrirModal('modal-nueva-compra')
}

// ── Autocomplete producto para compras ──────────────
let productoSeleccionadoCompra = null
let pickerListenersInit = false

function initProductoPicker() {
  if (pickerListenersInit) return
  pickerListenersInit = true

  const input = document.getElementById('input-buscar-producto-compra')
  const dropdown = document.getElementById('dropdown-productos-compra')
  const btnClear = document.getElementById('btn-clear-busqueda')
  const btnQuitar = document.getElementById('btn-quitar-producto-seleccionado')

  // Buscar al escribir
  input.addEventListener('input', () => {
    const termino = input.value.trim().toLowerCase()
    btnClear.classList.toggle('hidden', termino.length === 0)

    if (termino.length === 0) {
      dropdown.classList.add('hidden')
      return
    }

    const resultados = productosDisponibles.filter(p =>
      p.nombre.toLowerCase().includes(termino) ||
      p.tipo.toLowerCase().includes(termino) ||
      `#${p.id}`.includes(termino)
    )

    mostrarDropdownProductos(resultados, termino)
  })

  // Mostrar todos al enfocar si el input está vacío
  input.addEventListener('focus', () => {
    if (input.value.trim() === '' && productosDisponibles.length > 0) {
      mostrarDropdownProductos(productosDisponibles, '')
    }
  })

  // Limpiar búsqueda
  btnClear.addEventListener('click', () => {
    input.value = ''
    btnClear.classList.add('hidden')
    dropdown.classList.add('hidden')
    input.focus()
  })

  // Quitar producto seleccionado
  btnQuitar.addEventListener('click', () => {
    resetProductoPicker()
  })

  // Cerrar dropdown al hacer clic fuera
  document.addEventListener('click', (e) => {
    const picker = document.getElementById('compra-producto-picker')
    if (picker && !picker.contains(e.target)) {
      dropdown.classList.add('hidden')
    }
  })
}

function mostrarDropdownProductos(resultados, termino) {
  const dropdown = document.getElementById('dropdown-productos-compra')
  dropdown.innerHTML = ''

  if (resultados.length === 0) {
    const empty = document.createElement('div')
    empty.className = 'px-4 py-3 text-center text-outline text-sm'
    empty.textContent = `No se encontró "${termino}"`
    dropdown.appendChild(empty)
  } else {
    resultados.forEach(p => {
      const item = document.createElement('div')
      item.className = 'px-4 py-2.5 flex items-center gap-3 hover:bg-gray-50 cursor-pointer transition-colors'

      const stockColor = p.stock > p.stock_minimo ? 'text-green-600' : p.stock > 0 ? 'text-yellow-600' : 'text-red-500'

      item.innerHTML = `
        <span class="text-base">${p.tipo === 'gorra' ? '🧢' : '👕'}</span>
        <div class="flex-1 min-w-0">
          <p class="text-sm font-bold truncate">${highlightMatch(p.nombre, termino)}</p>
          <p class="text-[10px] text-outline">#${p.id} · ${p.tipo} · <span class="${stockColor}">Stock: ${p.stock}</span></p>
        </div>
      `

      item.addEventListener('click', () => seleccionarProductoCompra(p))
      dropdown.appendChild(item)
    })
  }

  // Separador + botón crear nuevo
  const separator = document.createElement('div')
  separator.className = 'border-t border-gray-100'
  dropdown.appendChild(separator)

  const btnNuevo = document.createElement('div')
  btnNuevo.className = 'px-4 py-2.5 flex items-center gap-2 hover:bg-[#E8F5F1] cursor-pointer transition-colors text-[#1D9E75]'
  btnNuevo.innerHTML = `
    <span class="material-symbols-outlined text-sm">add_circle</span>
    <span class="text-sm font-bold">Crear nuevo producto</span>
  `
  btnNuevo.addEventListener('click', () => {
    dropdown.classList.add('hidden')
    cerrarModal('modal-nueva-compra')
    mostrarModalAgregarProducto()
  })
  dropdown.appendChild(btnNuevo)

  dropdown.classList.remove('hidden')
}

function highlightMatch(text, term) {
  if (!term) return text
  const regex = new RegExp(`(${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')
  return text.replace(regex, '<span style="background:#d1fae5;border-radius:2px;padding:0 1px">$1</span>')
}

function seleccionarProductoCompra(producto) {
  productoSeleccionadoCompra = producto

  // Ocultar input, mostrar chip
  const input = document.getElementById('input-buscar-producto-compra')
  const dropdown = document.getElementById('dropdown-productos-compra')
  const chip = document.getElementById('producto-seleccionado-chip')

  input.parentElement.classList.add('hidden')
  dropdown.classList.add('hidden')

  document.getElementById('chip-emoji').textContent = producto.tipo === 'gorra' ? '🧢' : '👕'
  document.getElementById('chip-nombre').textContent = producto.nombre
  document.getElementById('chip-id').textContent = `#${producto.id}`
  chip.classList.remove('hidden')

  // Focus en costo
  document.getElementById('input-compra-costo').focus()
}

function resetProductoPicker() {
  productoSeleccionadoCompra = null
  const input = document.getElementById('input-buscar-producto-compra')
  const chip = document.getElementById('producto-seleccionado-chip')
  const dropdown = document.getElementById('dropdown-productos-compra')
  const btnClear = document.getElementById('btn-clear-busqueda')

  if (input) {
    input.value = ''
    input.parentElement.classList.remove('hidden')
  }
  if (chip) chip.classList.add('hidden')
  if (dropdown) dropdown.classList.add('hidden')
  if (btnClear) btnClear.classList.add('hidden')
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

  // Inicializar picker listeners (solo una vez)
  initProductoPicker()
}

function agregarItemCompra() {
  if (!productoSeleccionadoCompra) {
    mostrarAlerta('Busca y selecciona un producto')
    return
  }

  const costo = parseFloat(document.getElementById('input-compra-costo').value)
  const cantidad = parseInt(document.getElementById('input-compra-cantidad').value)

  if (isNaN(costo) || costo <= 0) { mostrarAlerta('Ingresa el costo de compra'); return }
  if (isNaN(cantidad) || cantidad <= 0) { mostrarAlerta('Ingresa una cantidad válida'); return }

  detallesCompra.push({
    producto_id: productoSeleccionadoCompra.id,
    producto_nombre: productoSeleccionadoCompra.nombre,
    cantidad,
    precio_unitario: costo,
    subtotal: costo * cantidad
  })

  // Reset inputs
  resetProductoPicker()
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

  container.innerHTML = ''

  detallesCompra.forEach((d, i) => {
    const row = document.createElement('div')
    row.className = 'flex items-center justify-between p-2 bg-gray-50 rounded-lg'
    row.innerHTML = `
      <div>
        <span class="font-body-m-bold text-sm">${d.producto_nombre}</span>
        <span class="text-outline text-xs ml-2">x${d.cantidad} @ $${d.precio_unitario.toFixed(2)}</span>
      </div>
      <div class="flex items-center gap-2">
        <span class="font-body-m-bold text-sm text-[#1D9E75]">$${d.subtotal.toFixed(2)}</span>
        <button class="btn-eliminar-item text-red-400 hover:text-red-600">
          <span class="material-symbols-outlined text-sm">close</span>
        </button>
      </div>
    `
    row.querySelector('.btn-eliminar-item').addEventListener('click', () => eliminarItemCompra(i))
    container.appendChild(row)
  })
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

// ═══════════════════════════════════════════════════════════════
// MÉTRICAS
// ═══════════════════════════════════════════════════════════════

let metricasRango = 'mes' // default

function obtenerFechasRango(rango) {
  const ahora = new Date()
  let inicio

  switch (rango) {
    case 'hoy':
      inicio = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate())
      break
    case 'semana':
      inicio = new Date(ahora)
      inicio.setDate(inicio.getDate() - 7)
      break
    case 'mes':
      inicio = new Date(ahora)
      inicio.setDate(inicio.getDate() - 30)
      break
    case 'todo':
      inicio = new Date(2020, 0, 1)
      break
    default:
      inicio = new Date(ahora)
      inicio.setDate(inicio.getDate() - 30)
  }

  // Fin = mañana (para incluir hoy completo)
  const fin = new Date(ahora)
  fin.setDate(fin.getDate() + 1)

  return {
    inicio: inicio.toISOString().split('T')[0],
    fin: fin.toISOString().split('T')[0]
  }
}

function seleccionarRangoMetricas(rango, button) {
  metricasRango = rango

  // Actualizar botones
  document.querySelectorAll('.metrics-range-btn').forEach(btn => {
    btn.classList.remove('bg-[#1D9E75]', 'text-white')
    btn.classList.add('text-outline', 'hover:bg-gray-50')
  })
  button.classList.remove('text-outline', 'hover:bg-gray-50')
  button.classList.add('bg-[#1D9E75]', 'text-white')

  cargarMetricas()
}

async function cargarMetricas() {
  const { inicio, fin } = obtenerFechasRango(metricasRango)

  try {
    const [metricas, ventasDia, comprasDia, topProductos, metodos] = await Promise.all([
      window.db.getMetricas(inicio, fin),
      window.db.getVentasPorDia(inicio, fin),
      window.db.getComprasPorDia(inicio, fin),
      window.db.getProductosMasVendidos(inicio, fin, 5),
      window.db.getVentasPorMetodo(inicio, fin)
    ])

    if (!metricas) return

    renderKPIs(metricas)
    renderChartVentasGastos(ventasDia, comprasDia)
    renderChartMetodosPago(metodos, metricas.ventasTotal)
    renderTopProductos(topProductos)
    renderEstadoInventario(metricas)
  } catch (err) {
    console.error('Error cargando métricas:', err)
  }
}

function renderKPIs(m) {
  const kpis = [
    {
      label: 'Ventas Totales',
      value: `$${m.ventasTotal.toFixed(2)}`,
      sub: `${m.ventasCount} ventas`,
      icon: 'point_of_sale',
      color: '#1D9E75',
      bgColor: '#E8F5F1'
    },
    {
      label: 'Gastos (Compras)',
      value: `$${m.comprasTotal.toFixed(2)}`,
      sub: `${m.comprasCount} compras`,
      icon: 'shopping_cart',
      color: '#e67e22',
      bgColor: '#fef3e2'
    },
    {
      label: 'Ganancia Bruta',
      value: `$${m.ganancia.toFixed(2)}`,
      sub: m.ganancia >= 0 ? 'Positiva' : 'Negativa',
      icon: m.ganancia >= 0 ? 'trending_up' : 'trending_down',
      color: m.ganancia >= 0 ? '#1D9E75' : '#e74c3c',
      bgColor: m.ganancia >= 0 ? '#E8F5F1' : '#fde8e8'
    },
    {
      label: 'Ticket Promedio',
      value: `$${m.ticketPromedio.toFixed(2)}`,
      sub: 'por venta',
      icon: 'receipt_long',
      color: '#3498db',
      bgColor: '#e8f4fd'
    }
  ]

  const container = document.getElementById('metricas-kpis')
  container.innerHTML = kpis.map(kpi => `
    <div class="bg-white rounded-xl border border-outline-variant p-4 flex items-start gap-3 transition-all hover:shadow-sm">
      <div class="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style="background:${kpi.bgColor}">
        <span class="material-symbols-outlined" style="color:${kpi.color};font-size:20px">${kpi.icon}</span>
      </div>
      <div class="min-w-0">
        <p class="text-xs text-outline mb-0.5 truncate">${kpi.label}</p>
        <p class="text-lg font-bold leading-tight" style="color:${kpi.color}">${kpi.value}</p>
        <p class="text-[10px] text-outline">${kpi.sub}</p>
      </div>
    </div>
  `).join('')
}

function renderChartVentasGastos(ventasDia, comprasDia) {
  const container = document.getElementById('chart-ventas-gastos')

  // Merge days
  const diasSet = new Set()
  ventasDia.forEach(v => diasSet.add(v.dia))
  comprasDia.forEach(c => diasSet.add(c.dia))
  const dias = [...diasSet].sort()

  if (dias.length === 0) {
    container.innerHTML = '<div class="h-full flex items-center justify-center text-outline text-sm">Sin datos en este período</div>'
    return
  }

  const ventasMap = {}
  const comprasMap = {}
  ventasDia.forEach(v => { ventasMap[v.dia] = v.total })
  comprasDia.forEach(c => { comprasMap[c.dia] = c.total })

  const maxVal = Math.max(
    ...dias.map(d => Math.max(ventasMap[d] || 0, comprasMap[d] || 0)),
    1
  )

  const BAR_AREA_H = 150 // px fijos para el área de barras

  container.innerHTML = ''

  // Legend
  const legend = document.createElement('div')
  legend.className = 'flex items-center gap-4 mb-2'
  legend.innerHTML = `
    <span class="flex items-center gap-1 text-[10px] text-outline">
      <span class="w-3 h-3 rounded-sm bg-[#1D9E75] inline-block"></span> Ventas
    </span>
    <span class="flex items-center gap-1 text-[10px] text-outline">
      <span class="w-3 h-3 rounded-sm bg-[#e67e22] inline-block"></span> Gastos
    </span>
  `
  container.appendChild(legend)

  // Bars area
  const barsRow = document.createElement('div')
  barsRow.style.cssText = `display:flex;align-items:flex-end;gap:3px;height:${BAR_AREA_H}px;overflow-x:auto;padding-bottom:4px;`

  dias.forEach(d => {
    const vPx = Math.max(Math.round((ventasMap[d] || 0) / maxVal * BAR_AREA_H), 3)
    const cPx = Math.max(Math.round((comprasMap[d] || 0) / maxVal * BAR_AREA_H), 3)
    const label = d.slice(5) // MM-DD

    const col = document.createElement('div')
    col.style.cssText = 'display:flex;flex-direction:column;align-items:center;flex:1;min-width:24px;'
    col.title = d

    const barPair = document.createElement('div')
    barPair.style.cssText = `display:flex;align-items:flex-end;gap:2px;width:100%;height:${BAR_AREA_H}px;`

    const barV = document.createElement('div')
    barV.style.cssText = `flex:1;height:${vPx}px;background:#1D9E75;border-radius:2px 2px 0 0;opacity:0.85;transition:height 0.4s ease;`
    barV.title = `Ventas: $${(ventasMap[d] || 0).toFixed(2)}`
    barV.className = 'chart-bar'

    const barC = document.createElement('div')
    barC.style.cssText = `flex:1;height:${cPx}px;background:#e67e22;border-radius:2px 2px 0 0;opacity:0.85;transition:height 0.4s ease;`
    barC.title = `Gastos: $${(comprasMap[d] || 0).toFixed(2)}`
    barC.className = 'chart-bar'

    barPair.appendChild(barV)
    barPair.appendChild(barC)
    col.appendChild(barPair)

    const lbl = document.createElement('span')
    lbl.style.cssText = 'font-size:9px;color:#6d7a73;margin-top:3px;white-space:nowrap;'
    lbl.textContent = label
    col.appendChild(lbl)

    barsRow.appendChild(col)
  })

  container.appendChild(barsRow)
}

function renderChartMetodosPago(metodos, totalVentas) {
  const container = document.getElementById('chart-metodos-pago')

  if (metodos.length === 0 || totalVentas === 0) {
    container.innerHTML = '<div class="h-full flex items-center justify-center text-outline text-sm">Sin datos</div>'
    return
  }

  const colores = {
    efectivo: '#1D9E75',
    tarjeta: '#3498db',
    transferencia: '#9b59b6'
  }

  const iconos = {
    efectivo: 'payments',
    tarjeta: 'credit_card',
    transferencia: 'account_balance'
  }

  // Build conic gradient for donut
  let acumulado = 0
  const segmentos = metodos.map(m => {
    const pct = (m.total / totalVentas) * 100
    const start = acumulado
    acumulado += pct
    return { ...m, pct, start, end: acumulado, color: colores[m.metodo_pago] || '#999' }
  })

  const gradientParts = segmentos.map(s =>
    `${s.color} ${s.start.toFixed(1)}% ${s.end.toFixed(1)}%`
  ).join(', ')

  container.innerHTML = `
    <div class="flex items-center gap-6 h-full">
      <div class="donut-chart" style="
        width: 140px; height: 140px; border-radius: 50%;
        background: conic-gradient(${gradientParts});
        position: relative; flex-shrink: 0;
      ">
        <div style="
          position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
          width: 80px; height: 80px; border-radius: 50%; background: white;
          display: flex; align-items: center; justify-content: center;
          flex-direction: column;
        ">
          <span class="text-lg font-bold text-[#1D9E75]">$${totalVentas.toFixed(0)}</span>
          <span class="text-[9px] text-outline">Total</span>
        </div>
      </div>
      <div class="flex flex-col gap-3 flex-1">
        ${segmentos.map(s => `
          <div class="flex items-center gap-2">
            <div class="w-3 h-3 rounded-sm flex-shrink-0" style="background:${s.color}"></div>
            <div class="flex-1">
              <div class="flex items-center justify-between">
                <span class="text-xs font-bold capitalize flex items-center gap-1">
                  <span class="material-symbols-outlined" style="font-size:14px;color:${s.color}">${iconos[s.metodo_pago] || 'help'}</span>
                  ${s.metodo_pago}
                </span>
                <span class="text-xs font-bold" style="color:${s.color}">${s.pct.toFixed(1)}%</span>
              </div>
              <div class="flex items-center justify-between">
                <span class="text-[10px] text-outline">${s.count} ventas</span>
                <span class="text-[10px] text-outline">$${s.total.toFixed(2)}</span>
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `
}

function renderTopProductos(productos) {
  const container = document.getElementById('chart-top-productos')

  if (productos.length === 0) {
    container.innerHTML = '<p class="text-center text-outline text-sm py-4">Sin ventas en este período</p>'
    return
  }

  const maxUnidades = Math.max(...productos.map(p => p.unidades), 1)

  container.innerHTML = `
    <div class="space-y-3">
      ${productos.map((p, i) => {
        const pct = (p.unidades / maxUnidades * 100).toFixed(1)
        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`
        return `
          <div class="flex items-center gap-3">
            <span class="text-sm w-6 text-center">${medal}</span>
            <div class="flex-1">
              <div class="flex items-center justify-between mb-1">
                <span class="text-xs font-bold truncate">${p.tipo === 'gorra' ? '🧢' : '👕'} ${p.nombre}</span>
                <span class="text-[10px] text-outline ml-2 flex-shrink-0">${p.unidades} uds · $${p.ingresos.toFixed(2)}</span>
              </div>
              <div class="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div class="h-full rounded-full transition-all" style="width:${pct}%;background:#1D9E75;opacity:${1 - i * 0.15}"></div>
              </div>
            </div>
          </div>
        `
      }).join('')}
    </div>
  `
}

function renderEstadoInventario(m) {
  const container = document.getElementById('chart-inventario')

  const disponible = m.totalProductos - m.stockBajo - m.sinStock
  const total = m.totalProductos || 1

  const items = [
    { label: 'Disponible', count: disponible, color: '#1D9E75', icon: 'check_circle' },
    { label: 'Stock bajo', count: m.stockBajo, color: '#f59e0b', icon: 'warning' },
    { label: 'Sin stock', count: m.sinStock, color: '#ef4444', icon: 'error' }
  ]

  container.innerHTML = `
    <div class="space-y-4">
      <!-- Barra horizontal apilada -->
      <div class="flex rounded-full h-4 overflow-hidden bg-gray-100">
        ${items.map(item => {
          const pct = (item.count / total * 100).toFixed(1)
          return `<div style="width:${pct}%;background:${item.color}" title="${item.label}: ${item.count}" class="transition-all"></div>`
        }).join('')}
      </div>

      <!-- Detalles -->
      <div class="grid grid-cols-3 gap-3">
        ${items.map(item => `
          <div class="text-center p-3 rounded-lg" style="background:${item.color}10">
            <span class="material-symbols-outlined mb-1" style="color:${item.color};font-size:20px">${item.icon}</span>
            <p class="text-xl font-bold" style="color:${item.color}">${item.count}</p>
            <p class="text-[10px] text-outline">${item.label}</p>
          </div>
        `).join('')}
      </div>

      <!-- Valor inventario -->
      <div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
        <div class="flex items-center gap-2">
          <span class="material-symbols-outlined text-[#1D9E75]" style="font-size:18px">account_balance_wallet</span>
          <span class="text-xs font-bold">Valor total del inventario</span>
        </div>
        <span class="text-sm font-bold text-[#1D9E75]">$${m.valorInventario.toFixed(2)}</span>
      </div>

      <div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
        <div class="flex items-center gap-2">
          <span class="material-symbols-outlined text-[#3498db]" style="font-size:18px">category</span>
          <span class="text-xs font-bold">Total de productos</span>
        </div>
        <span class="text-sm font-bold text-[#3498db]">${m.totalProductos}</span>
      </div>
    </div>
  `
}

