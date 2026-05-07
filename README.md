# Kino POS

Kino POS es un punto de venta de escritorio para tiendas de artículos. Está pensado para operar de forma local en una sola máquina, con datos persistidos en SQLite y una interfaz sencilla para vender, administrar inventario y revisar el historial de ventas.

## Qué hace

- Gestiona un catálogo de productos con precio, stock y stock mínimo.
- Permite agregar productos al carrito y registrar ventas.
- Guarda cada venta con su folio, método de pago, total y fecha.
- Registra movimientos de inventario para entradas, ventas y ajustes.
- Muestra una vista de inventario para revisar existencias y mantener el control de stock.
- Conserva un historial de ventas para consultar operaciones anteriores.

## Tecnologías

- Electron 41: framework de escritorio que permite empaquetar la app como una aplicación nativa para Windows y Linux.
- Node.js 22: runtime principal para ejecutar la lógica del proceso principal, el preload y las utilidades del proyecto.
- SQLite: motor de base de datos local para guardar productos, ventas, detalles de venta y movimientos de inventario.
- better-sqlite3: librería usada para conectar Node.js con SQLite de forma directa y eficiente.
- HTML, CSS y JavaScript vanilla: tecnologías base de la interfaz de usuario en el renderer.
- Tailwind CSS: sistema de estilos utilitario para construir y mantener la interfaz visual.
- PostCSS y Autoprefixer: procesamiento de CSS y compatibilidad entre navegadores.
- electron-builder: herramienta para generar instalables como `.deb` y `.AppImage`.
- contextBridge y preload.js: puente seguro entre el proceso principal de Electron y la interfaz.

## Arquitectura general

El proyecto está dividido en tres capas principales:

- Proceso principal de Electron: arranca la aplicación, controla la ventana y coordina el acceso al sistema.
- Preload: expone una API segura al renderer para consultar y guardar información en la base de datos.
- Renderer: contiene la interfaz visual en HTML, CSS y JavaScript vanilla.

## Base de datos

La aplicación usa SQLite para almacenar información localmente. La base de datos se crea y verifica al iniciar la app, y maneja estas entidades principales:

- Productos: nombre, tipo, precio, stock, stock mínimo y fecha de creación.
- Ventas: folio, total, método de pago, fecha y notas.
- Detalle de venta: productos vendidos, cantidades, precio unitario y subtotal.
- Movimientos de inventario: entradas, ventas y ajustes con su motivo.

## Requisitos

- Node.js 22 o superior.
- npm.
- En Linux, dependencias del sistema necesarias para compilar módulos nativos de Electron, como `better-sqlite3`.

## Instalación

Desde la carpeta `kino_pos/` ejecuta:

```bash
npm install
```

Ese comando instala las dependencias y recompila `better-sqlite3` automáticamente mediante el script `postinstall`.

## Ejecutar la app

Desde `kino_pos/`:

```bash
npm start
```

Ese comando recompila el módulo nativo, genera los estilos de Tailwind y abre la aplicación de Electron.

## Desarrollo

Si quieres trabajar con recarga de estilos:

```bash
npm run dev
```

## Scripts disponibles

Estos son los scripts principales definidos en `package.json`:

- `npm run build:css`: compila los estilos de Tailwind.
- `npm run watch:css`: recompila los estilos en modo observador.
- `npm run start`: recompila el módulo nativo, genera CSS y abre la aplicación.
- `npm run dev`: abre Electron y mantiene la compilación de estilos en segundo plano.
- `npm run dist:linux`: genera instalables `.deb` y `.AppImage` para Linux.

## Flujo de uso

1. Instala dependencias con `npm install` dentro de `kino_pos/`.
2. Ejecuta `npm start` para abrir la app.
3. Carga productos en el inventario si la base de datos está vacía.
4. Registra ventas desde el catálogo y revisa el historial cuando sea necesario.


## Estructura general

- `main.js`: proceso principal de Electron.
- `preload.js`: puente seguro entre Electron y la interfaz.
- `database/`: lógica de SQLite y datos iniciales.
- `renderer/`: interfaz HTML, CSS y JavaScript.

## Generar instalables para Linux Mint

Desde `kino_pos/`:

```bash
npm install
npm run dist:linux
```

Los instalables se generan en `kino_pos/dist/`:

- `*.deb` para instalar en Linux Mint.
- `*.AppImage` para ejecutar sin instalar.
