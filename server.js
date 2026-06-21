require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');
const fs = require('fs');

const { initDB } = require('./db/database');

const app = express();
const PORT = process.env.PORT || 3000;

// ── Ensure upload directories exist ──────────────────
const uploadDirs = [
  path.join(__dirname, 'public/uploads/accesos'),
  path.join(__dirname, 'public/uploads/perfiles'),
];
uploadDirs.forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// ── Middleware ────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// ── Routes ────────────────────────────────────────────
app.use('/api/auth',           require('./routes/auth'));
app.use('/api/usuarios',       require('./routes/usuarios'));
app.use('/api/visitas',        require('./routes/visitas'));
app.use('/api/accesos',        require('./routes/accesos'));
app.use('/api/notificaciones', require('./routes/notificaciones'));

// Config endpoint
app.get('/api/config', (req, res) => {
  const { getDB } = require('./db/database');
  const db = getDB();
  const rows = db.prepare('SELECT clave, valor FROM config').all();
  const config = {};
  rows.forEach(r => { config[r.clave] = r.valor; });
  res.json({ config });
});

// ── SPA fallback ──────────────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ── Start ─────────────────────────────────────────────
initDB();
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
