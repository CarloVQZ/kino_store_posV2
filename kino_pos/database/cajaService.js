/**
 * Servicio de corte de caja: sesiones, movimientos, cortes X/Z, auditoría.
 */
const db = require('./db')

function generarFolioSesion() {
  return 'S' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 6).toUpperCase()
}

function generarFolioCorte(tipo) {
  return `${tipo}-${Date.now().toString(36).toUpperCase()}`
}

function auditar(usuarioId, accion, detalle) {
  const det = detalle == null ? null : (typeof detalle === 'string' ? detalle : JSON.stringify(detalle))
  db.prepare(`
    INSERT INTO auditoria_caja (usuario_id, accion, detalle, hora)
    VALUES (?, ?, ?, datetime('now'))
  `).run(usuarioId ?? null, accion, det)
}

function obtenerSesion(sesionId) {
  return db.prepare('SELECT * FROM sesion_caja WHERE id = ?').get(sesionId)
}

function assertSesionAbierta(sesionId) {
  const s = obtenerSesion(sesionId)
  if (!s) throw new Error('Sesión no encontrada')
  if (s.estado !== 'abierta') throw new Error('La sesión de caja está cerrada')
  return s
}

function verificarAutorizador(autorizadoPorId) {
  const u = db.prepare('SELECT id, rol FROM usuario WHERE id = ? AND activo = 1').get(autorizadoPorId)
  if (!u) throw new Error('Usuario autorizador no válido')
  if (u.rol !== 'admin' && u.rol !== 'gerente') {
    throw new Error('Solo administrador o gerente puede autorizar retiros e ingresos de efectivo')
  }
  return u
}

function calcularResumenSesion(sesionId) {
  const sesion = obtenerSesion(sesionId)
  if (!sesion) throw new Error('Sesión no encontrada')

  const movs = db.prepare(`
    SELECT * FROM movimiento_caja WHERE sesion_id = ? ORDER BY id ASC
  `).all(sesionId)

  let totalVentasEfectivo = 0
  let totalVentasTarjeta = 0
  let totalVentasOtro = 0
  let totalDevoluciones = 0
  let totalRetiros = 0
  let totalIngresos = 0
  let numTransacciones = 0

  for (const m of movs) {
    if (m.estado !== 'activo') continue
    const mp = m.forma_pago
    const mont = Number(m.monto)

    if (m.tipo === 'venta') {
      numTransacciones += 1
      if (mp === 'efectivo') totalVentasEfectivo += mont
      else if (mp === 'tarjeta') totalVentasTarjeta += mont
      else if (mp === 'transferencia') totalVentasOtro += mont
    } else if (m.tipo === 'devolucion') {
      numTransacciones += 1
      if (mp === 'efectivo') totalDevoluciones += mont
    } else if (m.tipo === 'cancelacion') {
      numTransacciones += 1
      if (mp === 'efectivo') totalDevoluciones += mont
    } else if (m.tipo === 'retiro') {
      totalRetiros += mont
      numTransacciones += 1
    } else if (m.tipo === 'ingreso') {
      totalIngresos += mont
      numTransacciones += 1
    }
  }

  const fondo = Number(sesion.fondo_inicial)
  const efectivoEsperado = fondo + totalVentasEfectivo - totalDevoluciones - totalRetiros + totalIngresos

  return {
    sesion,
    fondoInicial: fondo,
    totalVentasEfectivo,
    totalVentasTarjeta,
    totalVentasOtro,
    totalDevoluciones,
    totalRetiros,
    totalIngresos,
    efectivoEsperado,
    numTransacciones,
    estadoSesion: sesion.estado
  }
}

function abrirCaja(usuarioId, cajaId, fondoInicial) {
  const fi = Number(fondoInicial)
  if (Number.isNaN(fi) || fi < 0) throw new Error('Fondo inicial inválido')

  const tx = db.transaction(() => {
    const abierta = db.prepare(`
      SELECT id FROM sesion_caja WHERE caja_id = ? AND estado = 'abierta'
    `).get(cajaId)
    if (abierta) throw new Error('Ya hay una sesión abierta en esta caja. Realice el corte Z antes de abrir otra.')

    const folio = generarFolioSesion()
    const r = db.prepare(`
      INSERT INTO sesion_caja (caja_id, usuario_id, folio_sesion, fondo_inicial, hora_apertura, estado)
      VALUES (?, ?, ?, ?, datetime('now'), 'abierta')
    `).run(cajaId, usuarioId, folio, fi)

    const sesionId = r.lastInsertRowid
    auditar(usuarioId, 'ABRIR_CAJA', { sesionId, cajaId, fondoInicial: fi, folio })

    return db.prepare(`
      SELECT s.*, u.nombre AS usuario_nombre, c.codigo AS caja_codigo, c.nombre AS caja_nombre
      FROM sesion_caja s
      JOIN usuario u ON u.id = s.usuario_id
      JOIN caja c ON c.id = s.caja_id
      WHERE s.id = ?
    `).get(sesionId)
  })

  return tx()
}

function getSesionAbiertaPorCaja(cajaId) {
  return db.prepare(`
    SELECT s.*, u.nombre AS usuario_nombre, c.codigo AS caja_codigo, c.nombre AS caja_nombre
    FROM sesion_caja s
    JOIN usuario u ON u.id = s.usuario_id
    JOIN caja c ON c.id = s.caja_id
    WHERE s.caja_id = ? AND s.estado = 'abierta'
    LIMIT 1
  `).get(cajaId)
}

function registrarMovimiento(sesionId, tipo, formaPago, monto, referencia, usuarioId) {
  assertSesionAbierta(sesionId)
  const m = Number(monto)
  if (Number.isNaN(m) || m <= 0) throw new Error('El monto debe ser mayor a cero')

  if (tipo === 'venta') throw new Error('Las ventas se registran solo al cobrar en el POS')
  if (tipo === 'retiro' || tipo === 'ingreso') {
    throw new Error('Retiros e ingresos deben registrarse con autorización de gerente')
  }
  const permitidos = ['devolucion', 'cancelacion']
  if (!permitidos.includes(tipo)) throw new Error('Tipo de movimiento no válido')

  const forma = formaPago || 'efectivo'

  const tx = db.transaction(() => {
    const r = db.prepare(`
      INSERT INTO movimiento_caja (sesion_id, tipo, forma_pago, monto, hora, referencia, estado, usuario_id)
      VALUES (?, ?, ?, ?, datetime('now'), ?, 'activo', ?)
    `).run(sesionId, tipo, forma, m, referencia || null, usuarioId)
    auditar(usuarioId, 'MOVIMIENTO_' + tipo.toUpperCase(), { movimientoId: r.lastInsertRowid, sesionId, monto: m, referencia })
    return r.lastInsertRowid
  })
  return tx()
}

function registrarRetiro(sesionId, monto, motivo, usuarioId, autorizadoPorId) {
  verificarAutorizador(autorizadoPorId)
  assertSesionAbierta(sesionId)
  const m = Number(monto)
  if (Number.isNaN(m) || m <= 0) throw new Error('Monto inválido')

  const tx = db.transaction(() => {
    const r = db.prepare(`
      INSERT INTO movimiento_caja (sesion_id, tipo, forma_pago, monto, hora, referencia, estado, usuario_id, autorizado_por, motivo)
      VALUES (?, 'retiro', 'efectivo', ?, datetime('now'), NULL, 'activo', ?, ?, ?)
    `).run(sesionId, m, usuarioId, autorizadoPorId, motivo || null)
    auditar(usuarioId, 'RETIRO_EFECTIVO', { monto: m, autorizadoPorId, motivo })
    return r.lastInsertRowid
  })
  return tx()
}

function registrarIngreso(sesionId, monto, motivo, usuarioId, autorizadoPorId) {
  verificarAutorizador(autorizadoPorId)
  assertSesionAbierta(sesionId)
  const m = Number(monto)
  if (Number.isNaN(m) || m <= 0) throw new Error('Monto inválido')

  const tx = db.transaction(() => {
    const r = db.prepare(`
      INSERT INTO movimiento_caja (sesion_id, tipo, forma_pago, monto, hora, referencia, estado, usuario_id, autorizado_por, motivo)
      VALUES (?, 'ingreso', 'efectivo', ?, datetime('now'), NULL, 'activo', ?, ?, ?)
    `).run(sesionId, m, usuarioId, autorizadoPorId, motivo || null)
    auditar(usuarioId, 'INGRESO_EFECTIVO', { monto: m, autorizadoPorId, motivo })
    return r.lastInsertRowid
  })
  return tx()
}

function corteParcialX(sesionId, usuarioId) {
  assertSesionAbierta(sesionId)
  const r = calcularResumenSesion(sesionId)
  auditar(usuarioId, 'CORTE_X_CONSULTA', { sesionId })
  return { ...r, tipoCorte: 'X' }
}

function corteTotalZ(sesionId, efectivoContado, usuarioId) {
  if (efectivoContado === '' || efectivoContado === null || efectivoContado === undefined) {
    throw new Error('Debes ingresar el efectivo contado físicamente para realizar el corte Z')
  }
  const ec = Number(efectivoContado)
  if (Number.isNaN(ec)) throw new Error('Efectivo contado no válido')

  const tx = db.transaction(() => {
    assertSesionAbierta(sesionId)
    const sum = calcularResumenSesion(sesionId)

    const diferencia = ec - sum.efectivoEsperado
    const folio = generarFolioCorte('Z')

    const ins = db.prepare(`
      INSERT INTO corte_caja (
        sesion_id, folio_corte, fondo_inicial,
        total_ventas_efectivo, total_ventas_tarjeta, total_ventas_otro,
        total_devoluciones, total_retiros, total_ingresos,
        efectivo_esperado, efectivo_contado, diferencia,
        tipo_corte, usuario_id, num_transacciones
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Z', ?, ?)
    `).run(
      sesionId,
      folio,
      sum.fondoInicial,
      sum.totalVentasEfectivo,
      sum.totalVentasTarjeta,
      sum.totalVentasOtro,
      sum.totalDevoluciones,
      sum.totalRetiros,
      sum.totalIngresos,
      sum.efectivoEsperado,
      ec,
      diferencia,
      usuarioId,
      sum.numTransacciones
    )

    const corteId = ins.lastInsertRowid

    db.prepare(`
      UPDATE sesion_caja SET estado = 'cerrada', hora_cierre = datetime('now') WHERE id = ?
    `).run(sesionId)

    auditar(usuarioId, 'CORTE_Z_CIERRE', { sesionId, corteId, folio, diferencia })

    return {
      corteId,
      folioCorte: folio,
      diferencia,
      efectivoEsperado: sum.efectivoEsperado,
      efectivoContado: ec,
      resumen: sum
    }
  })

  return tx()
}

function generarTicketCorte(corteId) {
  const row = db.prepare(`
    SELECT c.*,
           s.folio_sesion, s.hora_apertura, s.hora_cierre, s.usuario_id AS usuario_apertura_id,
           u.nombre AS usuario_corte_nombre,
           ua.nombre AS cajero_apertura_nombre,
           ca.codigo AS caja_codigo, ca.nombre AS caja_nombre
    FROM corte_caja c
    JOIN sesion_caja s ON s.id = c.sesion_id
    JOIN caja ca ON ca.id = s.caja_id
    JOIN usuario u ON u.id = c.usuario_id
    JOIN usuario ua ON ua.id = s.usuario_id
    WHERE c.id = ?
  `).get(corteId)

  if (!row) throw new Error('Corte no encontrado')

  let diferenciaLabel = 'Cuadre perfecto'
  if (row.diferencia > 0) diferenciaLabel = 'Sobrante'
  else if (row.diferencia < 0) diferenciaLabel = 'Faltante'

  return {
    folioCorte: row.folio_corte,
    tipoCorte: row.tipo_corte,
    periodo: { inicio: row.hora_apertura, fin: row.hora_cierre || row.hora_corte },
    caja: { codigo: row.caja_codigo, nombre: row.caja_nombre },
    cajeroApertura: row.cajero_apertura_nombre,
    usuarioCorte: row.usuario_corte_nombre,
    fondoInicial: row.fondo_inicial,
    ventasEfectivo: row.total_ventas_efectivo,
    ventasTarjeta: row.total_ventas_tarjeta,
    ventasOtro: row.total_ventas_otro,
    totalDevoluciones: row.total_devoluciones,
    totalRetiros: row.total_retiros,
    totalIngresos: row.total_ingresos,
    efectivoEsperado: row.efectivo_esperado,
    efectivoContado: row.efectivo_contado,
    diferencia: row.diferencia,
    diferenciaLabel,
    numTransacciones: row.num_transacciones,
    horaCorte: row.hora_corte,
    folioSesion: row.folio_sesion
  }
}

function registrarVentaEnSesion(folio, total, metodoPago, notas, sesionId, usuarioId) {
  assertSesionAbierta(sesionId)
  const t = Number(total)
  if (Number.isNaN(t) || t <= 0) throw new Error('Total de venta inválido')

  const tx = db.transaction(() => {
    const vr = db.prepare(`
      INSERT INTO venta (folio, total, metodo_pago, notas, sesion_id, estado)
      VALUES (?, ?, ?, ?, ?, 'activa')
    `).run(folio, t, metodoPago, notas || null, sesionId)
    const ventaId = vr.lastInsertRowid

    db.prepare(`
      INSERT INTO movimiento_caja (sesion_id, tipo, forma_pago, monto, hora, referencia, estado, usuario_id)
      VALUES (?, 'venta', ?, ?, datetime('now'), ?, 'activo', ?)
    `).run(sesionId, metodoPago, t, folio, usuarioId)

    auditar(usuarioId, 'VENTA_COBRADA', { ventaId, folio, total: t, metodoPago })
    return ventaId
  })
  return tx()
}

function cancelarVentaEnSesion(ventaId, usuarioId) {
  const tx = db.transaction(() => {
    const v = db.prepare('SELECT * FROM venta WHERE id = ?').get(ventaId)
    if (!v) throw new Error('Venta no encontrada')
    if (v.estado === 'cancelada') throw new Error('La venta ya está cancelada')
    if (!v.sesion_id) throw new Error('Esta venta no pertenece a una sesión de caja registrada')

    assertSesionAbierta(v.sesion_id)

    const detalles = db.prepare('SELECT * FROM detalle_venta WHERE venta_id = ?').all(ventaId)
    for (const det of detalles) {
      const prod = db.prepare('SELECT stock FROM producto WHERE id = ?').get(det.producto_id)
      db.prepare('UPDATE producto SET stock = ? WHERE id = ?').run(prod.stock + det.cantidad, det.producto_id)
      db.prepare(`
        INSERT INTO movimiento_inventario (producto_id, tipo, cantidad, motivo)
        VALUES (?, 'entrada', ?, ?)
      `).run(det.producto_id, det.cantidad, `Cancelación venta ${v.folio}`)
    }

    db.prepare(`UPDATE venta SET estado = 'cancelada' WHERE id = ?`).run(ventaId)

    db.prepare(`
      UPDATE movimiento_caja SET estado = 'cancelado'
      WHERE sesion_id = ? AND referencia = ? AND tipo = 'venta'
    `).run(v.sesion_id, v.folio)

    if (v.metodo_pago === 'efectivo') {
      db.prepare(`
        INSERT INTO movimiento_caja (sesion_id, tipo, forma_pago, monto, hora, referencia, estado, usuario_id)
        VALUES (?, 'cancelacion', 'efectivo', ?, datetime('now'), ?, 'activo', ?)
      `).run(v.sesion_id, v.total, `${v.folio}-CAN`, usuarioId)
    }

    auditar(usuarioId, 'CANCELAR_VENTA', { ventaId, folio: v.folio })
    return true
  })
  return tx()
}

function listarMovimientosSesion(sesionId, limite) {
  const n = Math.min(Math.max(parseInt(limite, 10) || 50, 1), 200)
  return db.prepare(`
    SELECT m.*, u.nombre AS usuario_nombre
    FROM movimiento_caja m
    LEFT JOIN usuario u ON u.id = m.usuario_id
    WHERE m.sesion_id = ?
    ORDER BY m.id DESC
    LIMIT ?
  `).all(sesionId, n)
}

function ultimosCortesZ(limite) {
  const n = Math.min(Math.max(parseInt(limite, 10) || 20, 1), 100)
  return db.prepare(`
    SELECT c.id, c.folio_corte, c.tipo_corte, c.hora_corte, c.diferencia, c.efectivo_esperado, c.efectivo_contado,
           s.folio_sesion, u.nombre AS usuario_nombre
    FROM corte_caja c
    JOIN sesion_caja s ON s.id = c.sesion_id
    JOIN usuario u ON u.id = c.usuario_id
    WHERE c.tipo_corte = 'Z'
    ORDER BY c.id DESC
    LIMIT ?
  `).all(n)
}

module.exports = {
  abrirCaja,
  getSesionAbiertaPorCaja,
  registrarMovimiento,
  registrarRetiro,
  registrarIngreso,
  corteParcialX,
  corteTotalZ,
  generarTicketCorte,
  calcularResumenSesion,
  registrarVentaEnSesion,
  cancelarVentaEnSesion,
  listarMovimientosSesion,
  ultimosCortesZ
}
