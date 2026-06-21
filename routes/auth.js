const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { getDB } = require('../db/database');
const { generarToken, verificarToken } = require('../middleware/auth');

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email y contraseña requeridos' });
  }

  const db = getDB();
  const usuario = db.prepare('SELECT * FROM usuarios WHERE email = ? AND activo = 1').get(email.toLowerCase().trim());

  if (!usuario) {
    return res.status(401).json({ error: 'Credenciales incorrectas' });
  }

  const valid = bcrypt.compareSync(password, usuario.password);
  if (!valid) {
    return res.status(401).json({ error: 'Credenciales incorrectas' });
  }

  const token = generarToken(usuario);
  const { password: _, ...usuarioSafe } = usuario;
  res.json({ token, usuario: usuarioSafe });
});

// GET /api/auth/me
router.get('/me', verificarToken, (req, res) => {
  const { password: _, ...usuarioSafe } = req.usuario;
  res.json({ usuario: usuarioSafe });
});

// POST /api/auth/change-password
router.post('/change-password', verificarToken, (req, res) => {
  const { password_actual, password_nuevo } = req.body;
  if (!password_actual || !password_nuevo) {
    return res.status(400).json({ error: 'Campos requeridos' });
  }
  if (password_nuevo.length < 8) {
    return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres' });
  }

  const db = getDB();
  const usuario = db.prepare('SELECT * FROM usuarios WHERE id = ?').get(req.usuario.id);
  const valid = bcrypt.compareSync(password_actual, usuario.password);
  if (!valid) {
    return res.status(401).json({ error: 'Contraseña actual incorrecta' });
  }

  const hash = bcrypt.hashSync(password_nuevo, 10);
  db.prepare('UPDATE usuarios SET password = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(hash, req.usuario.id);
  res.json({ ok: true });
});

module.exports = router;
