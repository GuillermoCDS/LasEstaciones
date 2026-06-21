const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { getDB } = require('../db/database');
const { verificarToken, requireRol } = require('../middleware/auth');

// GET /api/usuarios
router.get('/', verificarToken, requireRol('admin'), (req, res) => {
  const { search, rol, activo } = req.query;
  const db = getDB();

  let query = 'SELECT id, nombre, apellido, email, rol, telefono, numero_casa, foto, activo, created_at FROM usuarios WHERE 1=1';
  const params = [];

  if (search) {
    query += ' AND (nombre LIKE ? OR apellido LIKE ? OR email LIKE ?)';
    const s = `%${search}%`;
    params.push(s, s, s);
  }
  if (rol) {
    query += ' AND rol = ?';
    params.push(rol);
  }
  if (activo !== undefined && activo !== '') {
    query += ' AND activo = ?';
    params.push(activo === 'true' ? 1 : 0);
  }

  query += ' ORDER BY nombre ASC';
  const usuarios = db.prepare(query).all(...params);
  res.json({ usuarios });
});

// GET /api/usuarios/:id
router.get('/:id', verificarToken, requireRol('admin'), (req, res) => {
  const db = getDB();
  const usuario = db.prepare(
    'SELECT id, nombre, apellido, email, rol, telefono, numero_casa, foto, activo FROM usuarios WHERE id = ?'
  ).get(req.params.id);

  if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado' });
  res.json({ usuario });
});

// POST /api/usuarios
router.post('/', verificarToken, requireRol('admin'), (req, res) => {
  const { nombre, apellido, email, password, rol, telefono, numero_casa } = req.body;

  if (!nombre || !apellido || !email || !password || !rol) {
    return res.status(400).json({ error: 'Campos obligatorios faltantes' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres' });
  }

  const db = getDB();
  const existe = db.prepare('SELECT id FROM usuarios WHERE email = ?').get(email.toLowerCase().trim());
  if (existe) return res.status(409).json({ error: 'El email ya está registrado' });

  const hash = bcrypt.hashSync(password, 10);
  const result = db.prepare(`
    INSERT INTO usuarios (nombre, apellido, email, password, rol, telefono, numero_casa, activo)
    VALUES (?, ?, ?, ?, ?, ?, ?, 1)
  `).run(nombre.trim(), apellido.trim(), email.toLowerCase().trim(), hash, rol, telefono || null, numero_casa || null);

  res.status(201).json({ id: result.lastInsertRowid, ok: true });
});

// PUT /api/usuarios/:id
router.put('/:id', verificarToken, requireRol('admin'), (req, res) => {
  const { nombre, apellido, telefono, rol, numero_casa, activo } = req.body;
  const db = getDB();

  const usuario = db.prepare('SELECT id FROM usuarios WHERE id = ?').get(req.params.id);
  if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado' });

  db.prepare(`
    UPDATE usuarios SET nombre = ?, apellido = ?, telefono = ?, rol = ?, numero_casa = ?, activo = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    nombre, apellido, telefono || null, rol, numero_casa || null,
    activo === 'true' || activo === true ? 1 : 0,
    req.params.id
  );

  res.json({ ok: true });
});

// DELETE /api/usuarios/:id  (soft delete — sets activo = 0)
router.delete('/:id', verificarToken, requireRol('admin'), (req, res) => {
  const db = getDB();
  db.prepare('UPDATE usuarios SET activo = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
