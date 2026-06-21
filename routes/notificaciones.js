const express = require('express');
const router = express.Router();
const { getDB } = require('../db/database');
const { verificarToken } = require('../middleware/auth');

// GET /api/notificaciones
router.get('/', verificarToken, (req, res) => {
  const db = getDB();
  const notificaciones = db.prepare(`
    SELECT * FROM notificaciones
    WHERE usuario_id = ?
    ORDER BY created_at DESC
    LIMIT 50
  `).all(req.usuario.id);

  const no_leidas = notificaciones.filter(n => !n.leida).length;
  res.json({ notificaciones, no_leidas });
});

// PUT /api/notificaciones/leer-todas
router.put('/leer-todas', verificarToken, (req, res) => {
  const db = getDB();
  db.prepare('UPDATE notificaciones SET leida = 1 WHERE usuario_id = ?').run(req.usuario.id);
  res.json({ ok: true });
});

// PUT /api/notificaciones/:id/leer
router.put('/:id/leer', verificarToken, (req, res) => {
  const db = getDB();
  db.prepare('UPDATE notificaciones SET leida = 1 WHERE id = ? AND usuario_id = ?').run(req.params.id, req.usuario.id);
  res.json({ ok: true });
});

module.exports = router;
