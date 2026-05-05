class Catalogo {
  constructor() {
    this.productos = [];
    this.filtroTipo = null;
    this.busqueda = '';
    this.stockMinimo = 5;
    this.init();
  }

  async init() {
    console.log('Inicializando Catálogo...');
    console.log('window.db disponible:', !!window.db);

    await this.cargarProductos();
    this.setupEventListeners();
    this.renderizar();
  }

  async cargarProductos() {
    try {
      if (!window.db || !window.db.getProductos) {
        console.error('window.db.getProductos no está disponible');
        this.productos = [];
        return;
      }
      this.productos = await window.db.getProductos();
      console.log('Productos cargados:', this.productos.length);
    } catch (err) {
      console.error('Error al cargar productos:', err);
      this.productos = [];
    }
  }

  setupEventListeners() {
    const searchInput = document.querySelector('.search-box input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.busqueda = e.target.value.toLowerCase();
        this.renderizar();
      });
    }

    const botonesFiltro = document.querySelectorAll('.filter-buttons button');
    botonesFiltro.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const tipo = e.target.dataset.tipo;

        botonesFiltro.forEach(b => b.classList.remove('active'));

        if (this.filtroTipo === tipo) {
          this.filtroTipo = null;
        } else {
          this.filtroTipo = tipo;
          e.target.classList.add('active');
        }

        this.renderizar();
      });
    });
  }

  getProductosFiltrados() {
    let resultado = this.productos;

    if (this.filtroTipo) {
      resultado = resultado.filter(p => p.tipo === this.filtroTipo);
    }

    if (this.busqueda) {
      resultado = resultado.filter(p =>
        p.nombre.toLowerCase().includes(this.busqueda)
      );
    }

    return resultado;
  }

  getEstadoStock(stock) {
    if (stock === 0) return { clase: 'sin-stock', texto: 'Sin stock' };
    if (stock < this.stockMinimo) return { clase: 'bajo', texto: `Bajo (${stock})` };
    return { clase: 'disponible', texto: `Disponible (${stock})` };
  }

  renderizar() {
    const grid = document.querySelector('.productos-grid');
    if (!grid) return;

    const filtrados = this.getProductosFiltrados();
    console.log('Renderizando productos filtrados:', filtrados.length);

    if (filtrados.length === 0) {
      grid.innerHTML = this.productos.length === 0
        ? '<div class="empty-state" style="grid-column: 1/-1;"><p>No hay productos en la base de datos</p></div>'
        : '<div class="empty-state" style="grid-column: 1/-1;"><p>No hay productos que coincidan</p></div>';
      return;
    }

    grid.innerHTML = filtrados.map(producto => {
      const { clase, texto } = this.getEstadoStock(producto.stock);
      return `
        <div class="producto-card" data-id="${producto.id}">
          <div class="producto-nombre">${producto.nombre}</div>
          <div class="producto-tipo">${producto.tipo}</div>
          <div class="producto-precio">$${producto.precio.toFixed(2)}</div>
          <div class="stock-badge ${clase}">${texto}</div>
        </div>
      `;
    }).join('');

    this.setupProductoClickListeners();
  }

  setupProductoClickListeners() {
    const cards = document.querySelectorAll('.producto-card');
    cards.forEach(card => {
      card.addEventListener('click', () => {
        const id = parseInt(card.dataset.id);
        const producto = this.productos.find(p => p.id === id);
        if (producto) {
          this.agregarAlCarrito(producto);
        }
      });
    });
  }

  agregarAlCarrito(producto) {
    if (producto.stock === 0) {
      alert('Producto sin stock');
      return;
    }
    window.dispatchEvent(new CustomEvent('agregarAlCarrito', { detail: producto }));
  }
}

document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM cargado, creando instancia de Catálogo');
  window.catalogo = new Catalogo();
});
