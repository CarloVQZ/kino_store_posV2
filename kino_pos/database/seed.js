const db = require('./db');

const productosDemo = [
  { nombre: 'Gorra Básica Negra', tipo: 'gorra', precio: 150, stock: 10, stock_minimo: 5 },
  { nombre: 'Gorra Deportiva Azul', tipo: 'gorra', precio: 180, stock: 2, stock_minimo: 5 },
  { nombre: 'Gorra Vintage Roja', tipo: 'gorra', precio: 200, stock: 0, stock_minimo: 5 },
  { nombre: 'Playera Clásica Blanca', tipo: 'playera', precio: 120, stock: 15, stock_minimo: 5 },
  { nombre: 'Playera Premium Gris', tipo: 'playera', precio: 250, stock: 3, stock_minimo: 5 },
  { nombre: 'Playera Oversized Negro', tipo: 'playera', precio: 280, stock: 0, stock_minimo: 5 },
];

productosDemo.forEach(p => {
  try {
    db.prepare(
      'INSERT INTO producto (nombre, tipo, precio, stock, stock_minimo) VALUES (?, ?, ?, ?, ?)'
    ).run(p.nombre, p.tipo, p.precio, p.stock, p.stock_minimo);
    console.log(`✓ Agregado: ${p.nombre}`);
  } catch (err) {
    console.log(`✗ ${p.nombre} ya existe o error: ${err.message}`);
  }
});

console.log('\nProductos en la BD:');
const todos = db.prepare('SELECT * FROM producto').all();
console.table(todos);
