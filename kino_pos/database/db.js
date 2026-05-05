const Database = require('better-sqlite3')
const path = require('path')

const db = new Database(path.join(__dirname, 'kino.db'))

db.exec(`
  CREATE TABLE IF NOT EXISTS producto (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre      TEXT NOT NULL,
    tipo        TEXT NOT NULL CHECK(tipo IN ('gorra', 'playera')),
    precio      REAL NOT NULL,
    stock       INTEGER NOT NULL DEFAULT 0,
    stock_minimo INTEGER NOT NULL DEFAULT 5,
    creado_en   TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS venta (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    folio       TEXT NOT NULL,
    total       REAL NOT NULL,
    metodo_pago TEXT NOT NULL CHECK(metodo_pago IN ('efectivo', 'tarjeta', 'transferencia')),
    fecha       TEXT DEFAULT (datetime('now')),
    notas       TEXT
  );

  CREATE TABLE IF NOT EXISTS detalle_venta (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    venta_id        INTEGER NOT NULL REFERENCES venta(id),
    producto_id     INTEGER NOT NULL REFERENCES producto(id),
    cantidad        INTEGER NOT NULL,
    precio_unitario REAL NOT NULL,
    subtotal        REAL NOT NULL
  );

  CREATE TABLE IF NOT EXISTS movimiento_inventario (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    producto_id INTEGER NOT NULL REFERENCES producto(id),
    tipo        TEXT NOT NULL CHECK(tipo IN ('entrada', 'venta', 'ajuste')),
    cantidad    INTEGER NOT NULL,
    motivo      TEXT,
    fecha       TEXT DEFAULT (datetime('now'))
  );
`)

module.exports = db