# AGENTS.md — CapShop POS

> Punto de venta de escritorio para gorras y playeras · Electron + SQLite · Linux Mint / Windows

---

## 1. Stack tecnológico

| Capa | Tecnología |
|------|------------|
| Runtime | Node.js v22 |
| Framework desktop | Electron v41 |
| Base de datos | SQLite via better-sqlite3 |
| UI | HTML + CSS + JS vanilla |
| Diseño | Google Stitch (mockups) |
| SO objetivo | Linux Mint / Windows |

---

## 2. Estructura del proyecto

```
kino_pos/
├── main.js              ← proceso principal Electron
├── preload.js           ← puente seguro Node ↔ UI (contextBridge)
├── package.json
├── .gitignore
├── database/
│   ├── db.js            ← conexión SQLite + creación de tablas
│   └── capshop.db       ← archivo de base de datos (gitignored)
└── renderer/
    ├── index.html
    ├── css/
    │   └── style.css
    └── js/
        ├── catalogo.js
        ├── inventario.js
        └── historial.js
```

---

## 3. Base de datos

Motor: SQLite. El archivo `capshop.db` se crea automáticamente al iniciar la app.

### producto
| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | INTEGER PK | Autoincrement desde 1 |
| nombre | TEXT | Nombre del producto |
| tipo | TEXT | `'gorra'` o `'playera'` |
| precio | REAL | Precio de venta |
| stock | INTEGER | Unidades disponibles |
| stock_minimo | INTEGER | Umbral de alerta (default 5) |
| creado_en | TEXT | Fecha de creación |

### venta
| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | INTEGER PK | Autoincrement desde 1 |
| folio | TEXT | Número de ticket |
| total | REAL | Monto total |
| metodo_pago | TEXT | `'efectivo'`, `'tarjeta'` o `'transferencia'` |
| fecha | TEXT | Fecha y hora |
| notas | TEXT | Comentarios opcionales |

### detalle_venta
| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | INTEGER PK | Autoincrement desde 1 |
| venta_id | INTEGER FK | → venta.id |
| producto_id | INTEGER FK | → producto.id |
| cantidad | INTEGER | Unidades vendidas |
| precio_unitario | REAL | Precio al momento de la venta |
| subtotal | REAL | cantidad × precio_unitario |

### movimiento_inventario
| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | INTEGER PK | Autoincrement desde 1 |
| producto_id | INTEGER FK | → producto.id |
| tipo | TEXT | `'entrada'`, `'venta'` o `'ajuste'` |
| cantidad | INTEGER | Unidades del movimiento |
| motivo | TEXT | Descripción del movimiento |
| fecha | TEXT | Fecha y hora |

---

## 4. API expuesta via preload.js

Disponible en `window.db` desde el renderer:

```js
window.db.getProductos()
window.db.addProducto(nombre, tipo, precio, stock, stock_minimo)
window.db.updateStock(id, stock)
window.db.addVenta(folio, total, metodo_pago, notas)
window.db.getVentas()
window.db.addDetalle(venta_id, producto_id, cantidad, precio_unitario, subtotal)
window.db.getDetalleVenta(venta_id)
window.db.addMovimiento(producto_id, tipo, cantidad, motivo)
```

---

## 5. Pantallas

| Pantalla | Descripción |
|----------|-------------|
| Catálogo | Grid de productos con filtros por tipo, búsqueda, semáforo de stock |
| Carrito | Sidebar derecho con productos, cantidades, método de pago y cobro |
| Inventario | Tabla editable de stock + formulario para agregar productos |
| Historial | Lista de ventas con fecha, total y método de pago |

---

## 6. Diseño UI

- Color acento: `#1D9E75`
- Layout: dos columnas — catálogo (izquierda) + carrito (300px derecha)
- Navegación: barra inferior con tabs Catálogo / Inventario / Historial
- Stock badges: 🟢 verde (disponible) · 🟡 amarillo (bajo) · 🔴 rojo (sin stock)
- Estilo: flat, minimal, bordes 0.5px, esquinas redondeadas, sin gradientes

---

## 7. Comandos útiles

```bash
npm start                          # Inicia la app
npm install electron --save-dev    # Instala Electron
npm install better-sqlite3         # Instala SQLite
node database/db.js                # Crea/verifica la base de datos
```

---

## 8. Checklist

### Planeación
- [x] Tecnología definida (Electron + SQLite)
- [x] Entorno instalado
- [x] Repositorio creado

### Base de datos
- [x] 4 tablas creadas
- [x] API expuesta via preload.js
- [ ] Productos de prueba insertados

### Diseño UI
- [x] Mockup generado en Google Stitch
- [x] Paleta de colores definida
- [ ] CSS base implementado

### Desarrollo
- [ ] Pantalla catálogo
- [ ] Carrito y cobro
- [ ] Pantalla inventario
- [ ] Pantalla historial

### Pruebas
- [ ] Ventas de prueba completas
- [ ] Stock se descuenta correctamente
- [ ] App en uso en el negocio