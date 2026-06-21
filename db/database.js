const Database = require('better-sqlite3');
const path = require('path');
const bcrypt = require('bcryptjs');
const fs = require('fs');

const DB_DIR = path.join(__dirname);
const DB_PATH = path.join(DB_DIR, 'fraccionamiento.db');

let db;

function getDB() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
  }
  return db;
}

function initDB() {
  const db = getDB();

  db.exec(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      apellido TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      rol TEXT NOT NULL CHECK(rol IN ('admin','residente','guardia','visitante')),
      telefono TEXT,
      numero_casa TEXT,
      foto TEXT,
      activo INTEGER NOT NULL DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS visitas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      codigo TEXT UNIQUE NOT NULL,
      residente_id INTEGER NOT NULL,
      tipo TEXT NOT NULL CHECK(tipo IN ('familiar','servicio','general')),
      nombre_visitante TEXT NOT NULL,
      telefono_visitante TEXT,
      empresa TEXT,
      fecha_programada DATE NOT NULL,
      hora_inicio TIME NOT NULL,
      hora_fin TIME,
      estado TEXT NOT NULL DEFAULT 'pendiente' CHECK(estado IN ('pendiente','aprobada','rechazada','completada','cancelada')),
      notas TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (residente_id) REFERENCES usuarios(id)
    );

    CREATE TABLE IF NOT EXISTS accesos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      visita_id INTEGER NOT NULL,
      guardia_id INTEGER NOT NULL,
      hora_entrada DATETIME DEFAULT CURRENT_TIMESTAMP,
      hora_salida DATETIME,
      matricula TEXT,
      color_vehiculo TEXT,
      marca_vehiculo TEXT,
      estado_vehiculo TEXT,
      foto_vehiculo TEXT,
      foto_identificacion TEXT,
      foto_visitante TEXT,
      observaciones TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (visita_id) REFERENCES visitas(id),
      FOREIGN KEY (guardia_id) REFERENCES usuarios(id)
    );

    CREATE TABLE IF NOT EXISTS notificaciones (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario_id INTEGER NOT NULL,
      titulo TEXT NOT NULL,
      mensaje TEXT NOT NULL,
      leida INTEGER NOT NULL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
    );

    CREATE TABLE IF NOT EXISTS config (
      clave TEXT PRIMARY KEY,
      valor TEXT NOT NULL
    );
  `);

  // Seed default config
  const configExist = db.prepare("SELECT COUNT(*) as c FROM config").get();
  if (configExist.c === 0) {
    db.prepare("INSERT OR IGNORE INTO config (clave, valor) VALUES ('nombre_fraccionamiento', 'Las Estaciones')").run();
  }

  // Seed default admin user
  const adminExist = db.prepare("SELECT COUNT(*) as c FROM usuarios WHERE rol = 'admin'").get();
  if (adminExist.c === 0) {
    const hash = bcrypt.hashSync('Admin1234!', 10);
    db.prepare(`
      INSERT INTO usuarios (nombre, apellido, email, password, rol, activo)
      VALUES ('Admin', 'Sistema', 'admin@fraccionamiento.com', ?, 'admin', 1)
    `).run(hash);

    const resHash = bcrypt.hashSync('Residente1!', 10);
    db.prepare(`
      INSERT INTO usuarios (nombre, apellido, email, password, rol, numero_casa, activo)
      VALUES ('Carlos', 'García', 'carlos@ejemplo.com', ?, 'residente', 'Casa-15', 1)
    `).run(resHash);

    const guardHash = bcrypt.hashSync('Guardia1!', 10);
    db.prepare(`
      INSERT INTO usuarios (nombre, apellido, email, password, rol, activo)
      VALUES ('Juan', 'Guardia', 'guardia@ejemplo.com', ?, 'guardia', 1)
    `).run(guardHash);
  }

  console.log('Base de datos inicializada correctamente');
}

module.exports = { getDB, initDB };
