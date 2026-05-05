// Estado del carrito
let carrito = []
let metodoSeleccionado = 'efectivo'

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
    alert('El carrito está vacío')
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
    alert(`✓ Venta completada\nFolio: ${folio}\nTotal: $${total.toFixed(2)}`)
    limpiarCarrito()
    await cargarProductos()
  } catch (err) {
    alert('Error al completar la venta: ' + err.message)
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
