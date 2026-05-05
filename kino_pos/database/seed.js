/**
 * Seed script — Llena la BD con datos de prueba para métricas
 * Ejecutar: node database/seed.js
 */
const Database = require('better-sqlite3')
const path = require('path')

const db = new Database(path.join(__dirname, 'kino.db'))

// ─── Helpers ─────────────────────────────────────────
function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function randomPick(arr) {
  return arr[Math.floor(Math.random() * arr.length)]
}

function fechaHace(dias, horaBase) {
  const d = new Date()
  d.setDate(d.getDate() - dias)
  d.setHours(horaBase || randomInt(9, 20), randomInt(0, 59), randomInt(0, 59))
  return d.toISOString().replace('T', ' ').slice(0, 19)
}

// ─── Limpiar datos existentes ────────────────────────
console.log('🗑  Limpiando datos existentes...')
db.exec(`
  DELETE FROM detalle_venta;
  DELETE FROM detalle_compra;
  DELETE FROM movimiento_inventario;
  DELETE FROM venta;
  DELETE FROM compra;
  DELETE FROM producto;
  DELETE FROM sqlite_sequence;
`)

// ─── 1. Productos ────────────────────────────────────
console.log('📦 Insertando productos...')
const productos = [
  { nombre: 'Gorra Básica Negra',       tipo: 'gorra',   precio: 150, stock: 18, stock_minimo: 5 },
  { nombre: 'Gorra Deportiva Azul',      tipo: 'gorra',   precio: 180, stock: 12, stock_minimo: 5 },
  { nombre: 'Gorra Vintage Roja',        tipo: 'gorra',   precio: 200, stock: 3,  stock_minimo: 5 },
  { nombre: 'Gorra Trucker Verde',       tipo: 'gorra',   precio: 160, stock: 8,  stock_minimo: 5 },
  { nombre: 'Gorra Dad Hat Beige',       tipo: 'gorra',   precio: 170, stock: 0,  stock_minimo: 5 },
  { nombre: 'Gorra Snapback Gris',       tipo: 'gorra',   precio: 190, stock: 6,  stock_minimo: 5 },
  { nombre: 'Playera Clásica Blanca',    tipo: 'playera', precio: 120, stock: 22, stock_minimo: 5 },
  { nombre: 'Playera Premium Gris',      tipo: 'playera', precio: 250, stock: 4,  stock_minimo: 5 },
  { nombre: 'Playera Oversized Negro',   tipo: 'playera', precio: 280, stock: 0,  stock_minimo: 5 },
  { nombre: 'Playera Cuello V Azul',     tipo: 'playera', precio: 140, stock: 14, stock_minimo: 5 },
  { nombre: 'Playera Polo Verde',        tipo: 'playera', precio: 220, stock: 7,  stock_minimo: 5 },
  { nombre: 'Playera Manga Larga Negra', tipo: 'playera', precio: 260, stock: 2,  stock_minimo: 5 },
]

const insertProd = db.prepare(
  'INSERT INTO producto (nombre, tipo, precio, stock, stock_minimo) VALUES (?, ?, ?, ?, ?)'
)

productos.forEach(p => {
  insertProd.run(p.nombre, p.tipo, p.precio, p.stock, p.stock_minimo)
})

const allProductos = db.prepare('SELECT * FROM producto').all()
console.log(`   ✓ ${allProductos.length} productos insertados`)

// ─── 2. Ventas (últimos 30 días) ─────────────────────
console.log('💰 Generando ventas...')

const metodosPago = ['efectivo', 'efectivo', 'efectivo', 'tarjeta', 'tarjeta', 'transferencia']
const insertVenta = db.prepare(
  'INSERT INTO venta (folio, total, metodo_pago, fecha, notas) VALUES (?, ?, ?, ?, ?)'
)
const insertDetalle = db.prepare(
  'INSERT INTO detalle_venta (venta_id, producto_id, cantidad, precio_unitario, subtotal) VALUES (?, ?, ?, ?, ?)'
)
const insertMov = db.prepare(
  'INSERT INTO movimiento_inventario (producto_id, tipo, cantidad, motivo, fecha) VALUES (?, ?, ?, ?, ?)'
)

let ventasCount = 0

// Generar entre 1-4 ventas por día durante 30 días
for (let dia = 0; dia <= 30; dia++) {
  const numVentas = dia === 0 ? randomInt(2, 4) : randomInt(0, 4) // hoy siempre tiene ventas

  for (let v = 0; v < numVentas; v++) {
    const fecha = fechaHace(dia)
    const folio = 'V' + Date.now().toString().slice(-5) + randomInt(100, 999)
    const metodo = randomPick(metodosPago)

    // Cada venta tiene 1-3 productos
    const numItems = randomInt(1, 3)
    const items = []
    const usados = new Set()

    for (let i = 0; i < numItems; i++) {
      let prod
      do {
        prod = randomPick(allProductos)
      } while (usados.has(prod.id))
      usados.add(prod.id)

      const cantidad = randomInt(1, 3)
      items.push({
        producto_id: prod.id,
        cantidad,
        precio_unitario: prod.precio,
        subtotal: prod.precio * cantidad
      })
    }

    const total = items.reduce((s, i) => s + i.subtotal, 0)

    // Insertar venta
    const result = insertVenta.run(folio, total, metodo, fecha, '')
    const ventaId = result.lastInsertRowid

    // Insertar detalles y movimientos
    items.forEach(item => {
      insertDetalle.run(ventaId, item.producto_id, item.cantidad, item.precio_unitario, item.subtotal)
      insertMov.run(item.producto_id, 'venta', item.cantidad, `Venta ${folio}`, fecha)
    })

    ventasCount++
  }
}
console.log(`   ✓ ${ventasCount} ventas generadas`)

// ─── 3. Compras a proveedores ────────────────────────
console.log('🚚 Generando compras...')

const proveedores = ['Gorras MX', 'TextilPro', 'Cap Supply Co.', 'Modas del Norte', 'Distribuidora Central']
const insertCompra = db.prepare(
  'INSERT INTO compra (folio, proveedor, total, estado, fecha, fecha_recepcion, notas) VALUES (?, ?, ?, ?, ?, ?, ?)'
)
const insertDetalleCompra = db.prepare(
  'INSERT INTO detalle_compra (compra_id, producto_id, cantidad, precio_unitario, subtotal) VALUES (?, ?, ?, ?, ?)'
)

const comprasData = [
  { dia: 28, proveedor: 'Gorras MX',            estado: 'recibida', items: [{ pid: 1, qty: 20, costo: 80 },  { pid: 2, qty: 15, costo: 95 }] },
  { dia: 21, proveedor: 'TextilPro',             estado: 'recibida', items: [{ pid: 7, qty: 25, costo: 55 },  { pid: 8, qty: 10, costo: 120 }] },
  { dia: 14, proveedor: 'Cap Supply Co.',         estado: 'recibida', items: [{ pid: 3, qty: 12, costo: 105 }, { pid: 4, qty: 10, costo: 85 }] },
  { dia: 7,  proveedor: 'Modas del Norte',        estado: 'recibida', items: [{ pid: 10, qty: 18, costo: 65 }, { pid: 11, qty: 8, costo: 110 }] },
  { dia: 3,  proveedor: 'Distribuidora Central',  estado: 'recibida', items: [{ pid: 6, qty: 10, costo: 100 }, { pid: 12, qty: 6, costo: 130 }] },
  { dia: 1,  proveedor: 'Gorras MX',              estado: 'pendiente', items: [{ pid: 5, qty: 15, costo: 90 }, { pid: 9, qty: 10, costo: 140 }] },
]

comprasData.forEach(c => {
  const fecha = fechaHace(c.dia, 10)
  const folio = 'C' + Date.now().toString().slice(-5) + randomInt(100, 999)
  const total = c.items.reduce((s, i) => s + (i.costo * i.qty), 0)
  const fechaRecepcion = c.estado === 'recibida' ? fechaHace(c.dia - 1, 14) : null

  const result = insertCompra.run(folio, c.proveedor, total, c.estado, fecha, fechaRecepcion, `Compra a ${c.proveedor}`)
  const compraId = result.lastInsertRowid

  c.items.forEach(item => {
    const subtotal = item.costo * item.qty
    insertDetalleCompra.run(compraId, item.pid, item.qty, item.costo, subtotal)

    if (c.estado === 'recibida') {
      insertMov.run(item.pid, 'entrada', item.qty, `Compra ${folio} recibida`, fechaRecepcion)
    }
  })
})

console.log(`   ✓ ${comprasData.length} compras generadas`)

// ─── Resumen ─────────────────────────────────────────
const totalVentas = db.prepare('SELECT COUNT(*) as c FROM venta').get().c
const totalCompras = db.prepare('SELECT COUNT(*) as c FROM compra').get().c
const totalProds = db.prepare('SELECT COUNT(*) as c FROM producto').get().c
const sumaVentas = db.prepare('SELECT COALESCE(SUM(total),0) as t FROM venta').get().t
const sumaCompras = db.prepare('SELECT COALESCE(SUM(total),0) as t FROM compra').get().t

console.log('\n═══════════════════════════════════════')
console.log('  📊 SEED COMPLETADO')
console.log('═══════════════════════════════════════')
console.log(`  Productos:  ${totalProds}`)
console.log(`  Ventas:     ${totalVentas}  ($${sumaVentas.toFixed(2)})`)
console.log(`  Compras:    ${totalCompras}  ($${sumaCompras.toFixed(2)})`)
console.log(`  Ganancia:   $${(sumaVentas - sumaCompras).toFixed(2)}`)
console.log('═══════════════════════════════════════\n')

db.close()
