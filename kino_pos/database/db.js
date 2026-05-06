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
    imagen      TEXT,
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

  CREATE TABLE IF NOT EXISTS compra (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    folio       TEXT NOT NULL,
    proveedor   TEXT NOT NULL,
    total       REAL NOT NULL,
    estado      TEXT NOT NULL CHECK(estado IN ('pendiente', 'recibida', 'cancelada')) DEFAULT 'pendiente',
    fecha       TEXT DEFAULT (datetime('now')),
    fecha_recepcion TEXT,
    notas       TEXT
  );

  CREATE TABLE IF NOT EXISTS detalle_compra (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    compra_id       INTEGER NOT NULL REFERENCES compra(id),
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

  CREATE TABLE IF NOT EXISTS usuario (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre      TEXT NOT NULL,
    usuario     TEXT NOT NULL UNIQUE,
    pin         TEXT NOT NULL,
    rol         TEXT NOT NULL CHECK(rol IN ('admin', 'gerente', 'cajero')),
    activo      INTEGER NOT NULL DEFAULT 1,
    creado_en   TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS configuracion (
    id          INTEGER PRIMARY KEY CHECK(id = 1),
    descuento_activo INTEGER NOT NULL DEFAULT 1,
    descuento_monto  REAL NOT NULL DEFAULT 500,
    descuento_porcentaje REAL NOT NULL DEFAULT 10
  );

  CREATE TABLE IF NOT EXISTS descuento_regla (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre        TEXT NOT NULL DEFAULT '',
    activo        INTEGER NOT NULL DEFAULT 1,
    monto_minimo  REAL NOT NULL DEFAULT 0,
    porcentaje    REAL NOT NULL DEFAULT 0
  );
`)

// Insertar admin por defecto si no hay usuarios
const crypto = require('crypto')
const countUsuarios = db.prepare('SELECT COUNT(*) as count FROM usuario').get().count
if (countUsuarios === 0) {
  const pinHash = crypto.createHash('sha256').update('1234').digest('hex')
  db.prepare(
    "INSERT INTO usuario (nombre, usuario, pin, rol) VALUES (?, ?, ?, ?)"
  ).run('Admin', 'admin', pinHash, 'admin')
  console.log('✓ Usuario admin creado (PIN: 1234)')
}

// Insertar configuración por defecto si no existe
const configCount = db.prepare('SELECT COUNT(*) as count FROM configuracion').get().count
if (configCount === 0) {
  db.prepare(
    "INSERT INTO configuracion (id, descuento_activo, descuento_monto, descuento_porcentaje) VALUES (1, 1, 500, 10)"
  ).run()
  console.log('✓ Configuración por defecto creada')
}

// Migrar a reglas de descuento múltiples (una fila por regla, cada una con toggle)
const reglasCount = db.prepare('SELECT COUNT(*) as count FROM descuento_regla').get().count
if (reglasCount === 0) {
  const row = db.prepare('SELECT * FROM configuracion WHERE id = 1').get()
  if (row) {
    db.prepare(
      'INSERT INTO descuento_regla (nombre, activo, monto_minimo, porcentaje) VALUES (?, ?, ?, ?)'
    ).run('Descuento por volumen', row.descuento_activo, row.descuento_monto, row.descuento_porcentaje)
  } else {
    db.prepare(
      'INSERT INTO descuento_regla (nombre, activo, monto_minimo, porcentaje) VALUES (?, 1, 500, 10)'
    ).run('Descuento por volumen')
  }
  console.log('✓ Reglas de descuento inicializadas')
}

// Migración: agregar columna imagen si no existe (para BD existentes)
try {
  const cols = db.prepare("PRAGMA table_info(producto)").all()
  if (!cols.find(c => c.name === 'imagen')) {
    db.exec("ALTER TABLE producto ADD COLUMN imagen TEXT")
    console.log('✓ Columna imagen agregada a producto')
  }
} catch (e) { /* ya existe */ }

module.exports = db