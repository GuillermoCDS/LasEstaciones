const express = require('express');
const router = express.Router();
const path = require('path');
const multer = require('multer');
const { getDB } = require('../db/database');
const { verificarToken, requireRol } = require('../middleware/auth');

// Multer storage for access photos
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../public/uploads/accesos'));
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${file.fieldname}${ext}`);
  }
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

const uploadFields = upload.fields([
  { name: 'foto_vehiculo', maxCount: 1 },
  { name: 'foto_identificacion', maxCount: 1 },
  { name: 'foto_visitante', maxCount: 1 }
]);

// GET /api/accesos/stats
router.get('/stats', verificarToken, requireRol('admin'), (req, res) => {
  const db = getDB();
  const hoy = new Date().toISOString().split('T')[0];
  const mesInicio = hoy.substring(0, 7) + '-01';

  const stats = {
    total_usuarios: db.prepare("SELECT COUNT(*) as c FROM usuarios WHERE activo = 1").get().c,
    total_residentes: db.prepare("SELECT COUNT(*) as c FROM usuarios WHERE rol = 'residente' AND activo = 1").get().c,
    entradas_hoy: db.prepare("SELECT COUNT(*) as c FROM accesos WHERE DATE(hora_entrada) = ?").get(hoy).c,
    visitas_hoy: db.prepare("SELECT COUNT(*) as c FROM visitas WHERE fecha_programada = ?").get(hoy).c,
    visitas_pendientes: db.prepare("SELECT COUNT(*) as c FROM visitas WHERE estado = 'pendiente'").get().c,
    visitas_mes: db.prepare("SELECT COUNT(*) as c FROM visitas WHERE fecha_programada >= ?").get(mesInicio).c,
    ultimas_entradas: db.prepare(`
      SELECT a.*, v.nombre_visitante, v.tipo, v.codigo,
             u.nombre AS residente_nombre, u.apellido AS residente_apellido, u.numero_casa
      FROM accesos a
      JOIN visitas v ON a.visita_id = v.id
      JOIN usuarios u ON v.residente_id = u.id
      ORDER BY a.hora_entrada DESC
      LIMIT 10
    `).all()
  };

  res.json({ stats });
});

// GET /api/accesos
router.get('/', verificarToken, requireRol('admin', 'guardia'), (req, res) => {
  const { fecha } = req.query;
  const db = getDB();

  let query = `
    SELECT a.*, v.nombre_visitante, v.tipo, v.codigo,
           u.nombre AS residente_nombre, u.apellido AS residente_apellido, u.numero_casa,
           g.nombre AS guardia_nombre, g.apellido AS guardia_apellido
    FROM accesos a
    JOIN visitas v ON a.visita_id = v.id
    JOIN usuarios u ON v.residente_id = u.id
    JOIN usuarios g ON a.guardia_id = g.id
    WHERE 1=1
  `;
  const params = [];

  if (fecha) {
    query += ' AND DATE(a.hora_entrada) = ?';
    params.push(fecha);
  }

  query += ' ORDER BY a.hora_entrada DESC';
  const registros = db.prepare(query).all(...params);
  res.json({ registros });
});

// POST /api/accesos/entrada
router.post('/entrada', verificarToken, requireRol('admin', 'guardia'), uploadFields, (req, res) => {
  const { visita_id, matricula, color_vehiculo, marca_vehiculo, estado_vehiculo, observaciones } = req.body;

  if (!visita_id) return res.status(400).json({ error: 'visita_id requerido' });

  const db = getDB();
  const visita = db.prepare("SELECT * FROM visitas WHERE id = ? AND estado IN ('pendiente','aprobada')").get(visita_id);
  if (!visita) return res.status(404).json({ error: 'Visita no encontrada o no disponible para registro' });

  const existente = db.prepare('SELECT id FROM accesos WHERE visita_id = ?').get(visita_id);
  if (existente) return res.status(409).json({ error: 'Ya existe un registro de entrada para esta visita' });

  const fotoVehiculo = req.files?.foto_vehiculo?.[0] ? `/uploads/accesos/${req.files.foto_vehiculo[0].filename}` : null;
  const fotoId = req.files?.foto_identificacion?.[0] ? `/uploads/accesos/${req.files.foto_identificacion[0].filename}` : null;
  const fotoVisitante = req.files?.foto_visitante?.[0] ? `/uploads/accesos/${req.files.foto_visitante[0].filename}` : null;

  const result = db.prepare(`
    INSERT INTO accesos (visita_id, guardia_id, matricula, color_vehiculo, marca_vehiculo, estado_vehiculo, foto_vehiculo, foto_identificacion, foto_visitante, observaciones)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(visita_id, req.usuario.id, matricula || null, color_vehiculo || null, marca_vehiculo || null, estado_vehiculo || null, fotoVehiculo, fotoId, fotoVisitante, observaciones || null);

  db.prepare("UPDATE visitas SET estado = 'completada', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(visita_id);

  // Notify resident
  db.prepare(`
    INSERT INTO notificaciones (usuario_id, titulo, mensaje)
    VALUES (?, 'Visita registrada', ?)
  `).run(visita.residente_id, `${visita.nombre_visitante} ingresó al fraccionamiento. Código: ${visita.codigo}`);

  res.status(201).json({ id: result.lastInsertRowid, ok: true });
});

// PUT /api/accesos/:id/salida
router.put('/:id/salida', verificarToken, requireRol('admin', 'guardia'), (req, res) => {
  const db = getDB();
  const registro = db.prepare('SELECT * FROM accesos WHERE id = ?').get(req.params.id);
  if (!registro) return res.status(404).json({ error: 'Registro no encontrado' });
  if (registro.hora_salida) return res.status(409).json({ error: 'La salida ya fue registrada' });

  db.prepare('UPDATE accesos SET hora_salida = CURRENT_TIMESTAMP WHERE id = ?').run(req.params.id);

  // Notify resident
  const visita = db.prepare('SELECT * FROM visitas WHERE id = ?').get(registro.visita_id);
  if (visita) {
    db.prepare(`
      INSERT INTO notificaciones (usuario_id, titulo, mensaje)
      VALUES (?, 'Visita finalizada', ?)
    `).run(visita.residente_id, `${visita.nombre_visitante} salió del fraccionamiento. Código: ${visita.codigo}`);
  }

  res.json({ ok: true });
});

module.exports = router;
