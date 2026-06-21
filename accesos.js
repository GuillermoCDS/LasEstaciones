# 🏠 Sistema de Control de Accesos — Fraccionamiento

Sistema web completo para gestión de accesos en fraccionamientos residenciales.

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
# 1. Entra a la carpeta
cd fraccionamiento

# 2. Instala dependencias
npm install

# 3. Crea tu archivo .env
cp .env.example .env
# Edita .env y cambia el JWT_SECRET

# 4. Inicia el servidor
npm start
# Para desarrollo con recarga automática:
npm run dev
```

El sistema estará en: **http://localhost:3000**

---

## 🌐 Opciones de hosting (de más económico a más potente)

### 1. 🟢 Railway.app — RECOMENDADO (gratis hasta cierto uso)
- Sube el código a GitHub
- En railway.app: "New Project" → Deploy from GitHub repo
- Agrega variable de entorno `JWT_SECRET`
- URL automática tipo `https://tu-app.up.railway.app`
- **Costo**: Gratis con límites, luego ~$5 USD/mes

### 2. 🔵 Render.com (gratis con sleep en inactividad)
- Conecta tu repo de GitHub
- "New Web Service" → Node.js
- Start command: `npm start`
- Agrega `JWT_SECRET` en Environment
- **Costo**: Gratis (se duerme tras 15 min sin uso), $7/mes para siempre activo

### 3. 🟡 Fly.io (muy bueno para producción)
```bash
npm install -g flyctl
flyctl auth login
flyctl launch
flyctl secrets set JWT_SECRET=tu_clave_secreta
flyctl deploy
```
- **Costo**: Gratis tier generoso, luego pay-per-use

### 4. 🟠 VPS en DigitalOcean / Hetzner / Contabo
Ideal si quieres control total y buenas velocidades en México.

```bash
# En el servidor Ubuntu/Debian:
sudo apt update && sudo apt install -y nodejs npm nginx

# Clona tu repo
git clone https://github.com/tu-usuario/fraccionamiento.git
cd fraccionamiento
npm install

# Instala PM2 para mantenerlo vivo
npm install -g pm2
cp .env.example .env  # edita el archivo
pm2 start server.js --name fraccionamiento
pm2 startup  # para que inicie al reiniciar el servidor
pm2 save
```

Luego configura Nginx como proxy inverso:
```nginx
server {
    listen 80;
    server_name tu-dominio.com;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

**Costos aproximados**:
- DigitalOcean Droplet: $6 USD/mes
- Hetzner CX11: ~€4/mes (muy buena relación calidad-precio)
- Contabo: ~€5/mes

### 5. 🔴 Hostinger VPS (opción económica en español)
- Panel en español, soporte en español
- **Costo**: Desde ~$4-8 USD/mes

---

## 📁 Estructura del proyecto

```
fraccionamiento/
├── server.js              ← Servidor principal
├── package.json
├── .env.example           ← Copia a .env
├── db/
│   └── database.js        ← Base de datos SQLite
├── middleware/
│   └── auth.js            ← Autenticación JWT
├── routes/
│   ├── auth.js            ← Login, perfil
│   ├── usuarios.js        ← CRUD usuarios
│   ├── visitas.js         ← Gestión de visitas
│   ├── accesos.js         ← Registros entrada/salida
│   └── notificaciones.js  ← Notificaciones
└── public/
    ├── index.html         ← Frontend SPA completo
    └── uploads/           ← Fotos (se crea automático)
        ├── perfiles/
        └── accesos/
```

## 🔒 Seguridad en producción

1. Cambia el `JWT_SECRET` por una cadena larga aleatoria
2. Usa HTTPS (Railway/Render lo incluyen gratis; en VPS usa Let's Encrypt + Certbot)
3. Considera hacer respaldos periódicos del archivo `db/fraccionamiento.db`

## 🗄️ Base de datos

Usa SQLite (un solo archivo). Fácil de respaldar:
```bash
# Respaldo
cp db/fraccionamiento.db db/respaldo_$(date +%Y%m%d).db
```

Para producción con muchos usuarios (>50 familias), considera migrar a PostgreSQL.
