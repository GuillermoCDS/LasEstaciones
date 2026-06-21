const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { getDB } = require('../db/database');
const { verificarToken, requireRol } = require('../middleware/auth');

function generarCodigo() {
  return uuidv4().replace(/-/g, '').substring(0, 8).toUpperCase();
}

// GET /api/visitas/hoy  — must be before /:id
router.get('/hoy', verificarToken, requireRol('admin', 'guardia'), (req, res) => {
  const db = getDB();
  const hoy = new Date().toISOString().split('T')[0];

  const visitas = db.prepare(`
    SELECT v.*, u.nombre AS residente_nombre, u.apellido AS residente_apellido, u.numero_casa,
           a.id AS registro_id, a.hora_entrada, a.hora_salida
    FROM visitas v
    JOIN usuarios u ON v.residente_id = u.id
    LEFT JOIN accesos a ON a.visita_id = v.id
    WHERE v.fecha_programada = ? AND v.estado IN ('pendiente','aprobada','completada')
    ORDER BY v.hora_inicio ASC
  `).all(hoy);

  res.json({ visitas, fecha: hoy });
});

// GET /api/visitas/buscar/:codigo
router.get('/buscar/:codigo', verificarToken, requireRol('admin', 'guardia'), (req, res) => {
  const db = getDB();
  const visita = db.prepare(`
    SELECT v.*, u.nombre AS residente_nombre, u.apellido AS residente_apellido, u.numero_casa
    FROM visitas v
    JOIN usuarios u ON v.residente_id = u.id
    WHERE v.codigo = ?
  `).get(req.params.codigo.toUpperCase());

  if (!visita) return res.status(404).json({ error: 'Visita no encontrada' });
  res.json({ visita });
});

// GET /api/visitas
router.get('/', verificarToken, (req, res) => {
  const { fecha, tipo, estado } = req.query;
  const db = getDB();
  const rol = req.usuario.rol;

  let query = `
    SELECT v.*, u.nombre AS residente_nombre, u.apellido AS residente_apellido, u.numero_casa
    FROM visitas v
    JOIN usuarios u ON v.residente_id = u.id
    WHERE 1=1
  `;
  const params = [];

  if (rol === 'residente') {
    query += ' AND v.residente_id = ?';
    params.push(req.usuario.id);
  }
  if (fecha) { query += ' AND v.fecha_programada = ?'; params.push(fecha); }
  if (tipo)  { query += ' AND v.tipo = ?'; params.push(tipo); }
  if (estado){ query += ' AND v.estado = ?'; params.push(estado); }

  query += ' ORDER BY v.fecha_programada DESC, v.hora_inicio DESC';
  const visitas = db.prepare(query).all(...params);
  res.json({ visitas });
});

// GET /api/visitas/:id
router.get('/:id', verificarToken, (req, res) => {
  const db = getDB();
  const visita = db.prepare(`
    SELECT v.*, u.nombre AS residente_nombre, u.apellido AS residente_apellido, u.numero_casa,
           a.id AS registro_id, a.hora_entrada, a.hora_salida, a.matricula, a.color_vehiculo,
           a.marca_vehiculo, a.foto_vehiculo, a.foto_identificacion, a.foto_visitante,
           g.nombre AS guardia_nombre, g.apellido AS guardia_apellido
    FROM visitas v
    JOIN usuarios u ON v.residente_id = u.id
    LEFT JOIN accesos a ON a.visita_id = v.id
    LEFT JOIN usuarios g ON a.guardia_id = g.id
    WHERE v.id = ?
  `).get(req.params.id);

  if (!visita) return res.status(404).json({ error: 'Visita no encontrada' });

  // Residents can only see their own visits
  if (req.usuario.rol === 'residente' && visita.residente_id !== req.usuario.id) {
    return res.status(403).json({ error: 'Sin permiso' });
  }

  res.json({ visita });
});

// POST /api/visitas
router.post('/', verificarToken, requireRol('admin', 'residente'), (req, res) => {
  const { tipo, nombre_visitante, telefono_visitante, empresa, fecha_programada, hora_inicio, hora_fin, notas } = req.body;

  if (!tipo || !nombre_visitante || !fecha_programada || !hora_inicio) {
    return res.status(400).json({ error: 'Campos obligatorios faltantes' });
  }

  const db = getDB();
  let codigo;
  let intentos = 0;
  do {
    codigo = generarCodigo();
    intentos++;
  } while (db.prepare('SELECT id FROM visitas WHERE codigo = ?').get(codigo) && intentos < 10);

  const residenteId = req.usuario.rol === 'residente' ? req.usuario.id : req.body.residente_id;
  if (!residenteId) return res.status(400).json({ error: 'residente_id requerido' });

  const result = db.prepare(`
    INSERT INTO visitas (codigo, residente_id, tipo, nombre_visitante, telefono_visitante, empresa, fecha_programada, hora_inicio, hora_fin, estado, notas)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pendiente', ?)
  `).run(codigo, residenteId, tipo, nombre_visitante.trim(), telefono_visitante || null, empresa || null, fecha_programada, hora_inicio, hora_fin || null, notas || null);

  // Notify the resident (if admin created it for them)
  if (req.usuario.rol === 'admin' && residenteId !== req.usuario.id) {
    db.prepare(`
      INSERT INTO notificaciones (usuario_id, titulo, mensaje)
      VALUES (?, 'Nueva visita agendada', ?)
    `).run(residenteId, `Se agendó una visita de ${nombre_visitante} para el ${fecha_programada} a las ${hora_inicio}. Código: ${codigo}`);
  }

  res.status(201).json({ id: result.lastInsertRowid, codigo, ok: true });
});

// PUT /api/visitas/:id/estado
router.put('/:id/estado', verificarToken, requireRol('admin'), (req, res) => {
  const { estado } = req.body;
  const estadosValidos = ['pendiente', 'aprobada', 'rechazada', 'completada', 'cancelada'];
  if (!estadosValidos.includes(estado)) {
    return res.status(400).json({ error: 'Estado inválido' });
  }

  const db = getDB();
  const visita = db.prepare('SELECT * FROM visitas WHERE id = ?').get(req.params.id);
  if (!visita) return res.status(404).json({ error: 'Visita no encontrada' });

  db.prepare('UPDATE visitas SET estado = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(estado, req.params.id);

  // Notify resident
  db.prepare(`
    INSERT INTO notificaciones (usuario_id, titulo, mensaje)
    VALUES (?, ?, ?)
  `).run(visita.residente_id, `Visita ${estado}`, `Tu visita de ${visita.nombre_visitante} (${visita.codigo}) fue marcada como ${estado}.`);

  res.json({ ok: true });
});

// DELETE /api/visitas/:id  (cancel)
router.delete('/:id', verificarToken, (req, res) => {
  const db = getDB();
  const visita = db.prepare('SELECT * FROM visitas WHERE id = ?').get(req.params.id);
  if (!visita) return res.status(404).json({ error: 'Visita no encontrada' });

  if (req.usuario.rol === 'residente' && visita.residente_id !== req.usuario.id) {
    return res.status(403).json({ error: 'Sin permiso' });
  }

  db.prepare("UPDATE visitas SET estado = 'cancelada', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
