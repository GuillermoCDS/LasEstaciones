# 🏠 Sistema de Control de Accesos — Las Estaciones

Sistema web completo para gestión de accesos en fraccionamientos residenciales. Construido con Node.js, Express y SQLite.

## Roles y permisos

| Rol | Permisos |
|-----|----------|
| **Admin** | Todo: usuarios, visitas, accesos, estadísticas |
| **Residente** | Agendar/ver sus visitas, notificaciones |
| **Guardia** | Buscar visitas, registrar entrada/salida, capturar fotos |

## Credenciales demo

| Usuario | Email | Contraseña |
|---------|-------|------------|
| Admin | admin@fraccionamiento.com | Admin1234! |
| Residente | carlos@ejemplo.com | Residente1! |
| Guardia | guardia@ejemplo.com | Guardia1! |

---

## ⚡ Instalación y ejecución local

### Requisitos
- Node.js 18 o superior (https://nodejs.org)

### Pasos

```bash
# 1. Instala dependencias
npm install

# 2. Crea tu archivo .env
cp .env.example .env
# Edita .env y cambia el JWT_SECRET

# 3. Inicia el servidor
npm start
# Para desarrollo con recarga automática:
npm run dev
```

El sistema estará en: **http://localhost:3000**

---

## 🚀 Deploy en Railway

1. Sube el código a GitHub
2. En [railway.app](https://railway.app): "New Project" → Deploy from GitHub repo
3. Agrega la variable de entorno `JWT_SECRET` con una cadena aleatoria larga
4. Railway detecta automáticamente Node.js y ejecuta `npm start`

---

## 📁 Estructura del proyecto

```
fraccionamiento/
├── server.js              ← Servidor principal (Express)
├── package.json
├── .env.example           ← Copia a .env
├── db/
│   └── database.js        ← Base de datos SQLite + inicialización
├── middleware/
│   └── auth.js            ← Autenticación JWT
├── routes/
│   ├── auth.js            ← Login, perfil, cambio de contraseña
│   ├── usuarios.js        ← CRUD usuarios
│   ├── visitas.js         ← Gestión de visitas
│   ├── accesos.js         ← Registros entrada/salida + fotos
│   └── notificaciones.js  ← Notificaciones
└── public/
    ├── index.html         ← Frontend SPA completo
    └── uploads/           ← Fotos (se crea automático)
        ├── perfiles/
        └── accesos/
```

## 🔒 Seguridad en producción

1. Cambia el `JWT_SECRET` por una cadena larga aleatoria
2. Usa HTTPS (Railway lo incluye gratis)
3. Haz respaldos periódicos del archivo `db/fraccionamiento.db`

## 🗄️ Base de datos

Usa SQLite (un solo archivo). Fácil de respaldar:

```bash
cp db/fraccionamiento.db db/respaldo_$(date +%Y%m%d).db
```