# restaurant-whatsapp-bot

> Bot de WhatsApp para restaurantes con sistema de reservas en tiempo real, construido con **Node.js + Baileys** y base de datos en **Supabase (PostgreSQL)**.

---

## Requisitos

### 1. Node.js 18+
Descarga desde [nodejs.org](https://nodejs.org/)

### 2. Git
Descarga desde [git-scm.com](https://git-scm.com/)
> Necesario para que `npm install` pueda descargar todas las dependencias.

### 3. Cuenta en Supabase (gratuita)
Crea tu proyecto en [supabase.com](https://supabase.com/) y ejecuta el SQL de `/database/schema.sql` en el **SQL Editor**.

---

## Cómo ejecutar el proyecto

```bash
# 1. Clona el repositorio
git clone https://github.com/tu-usuario/restaurant-whatsapp-bot.git
cd restaurant-whatsapp-bot

# 2. Instala las dependencias (solo la primera vez)
npm install

# 3. Configura las variables de entorno
copy .env.example .env
# Edita .env con tus credenciales de Supabase y tu número de dueño

# 4. Inicia el bot
npm start
```

Escanea el código QR que aparece en la terminal con tu WhatsApp para vincular la sesión.

> Si el bot muestra error 401, borra la sesión expirada con `rmdir /s /q auth_info_baileys` y vuelve a ejecutar `npm start`.

---

## Descripción

Bot conversacional de WhatsApp para la gestión de reservas de un restaurante. El sistema guía al cliente paso a paso mediante una máquina de estados, valida disponibilidad en tiempo real contra la base de datos y notifica al dueño automáticamente ante cada nueva reserva o cancelación.

---

## Tecnologías Utilizadas

| Capa | Tecnología |
|------|------------|
| Runtime | Node.js 18+ (ES Modules) |
| WhatsApp | [@whiskeysockets/baileys](https://github.com/WhiskeySockets/Baileys) |
| Base de datos | Supabase (PostgreSQL) |
| API REST | Express.js |
| Utilidades | date-fns, pino, qrcode-terminal, dotenv |

---

## Arquitectura

```
Usuario (WhatsApp)
        ↓  WebSocket (Baileys)
    whatsapp.js  ←→  QR / sesión / eventos
        ↓
     flow.js  ←→  sessions Map (estado en memoria)
        ↓
   supabase.js  ←→  Supabase PostgreSQL
```

### Flujo de una reserva

1. El usuario envía "1" al bot
2. El bot inicia el flujo step-by-step: nombre → personas → fecha → hora
3. Se valida disponibilidad de mesas en Supabase
4. Si hay mesa libre, se inserta la reserva y se confirma al cliente
5. El dueño recibe una notificación automática en su WhatsApp

---

## Funcionalidades

### Cliente
- Consultar el menú del restaurante
- Hacer una reserva (nombre, personas, fecha y hora)
- Ver sus reservas activas
- Cancelar una reserva existente

### Sistema
- Validación de fechas pasadas y formato de hora
- Control de horario de atención configurable via `.env`
- Verificación de disponibilidad de mesas en tiempo real
- Bloqueo de sesión durante el procesamiento para evitar reservas duplicadas
- Soporte para usuarios con número oculto (WhatsApp LID)

### Administrador
- Módulo de administración restringido al número configurado en `.env`
- Consulta de todas las reservas activas del sistema (opción 6)
- Notificaciones automáticas ante cada nueva reserva o cancelación

---

## Variables de Entorno

| Variable | Descripción | Ejemplo |
|---|---|---|
| `SUPABASE_URL` | URL del proyecto Supabase | `https://xxx.supabase.co` |
| `SUPABASE_KEY` | Clave anónima de Supabase | `eyJ...` |
| `OWNER_PHONE` | Número(s) del admin separados por coma | `5491112345678,100820095881311` |
| `RESTAURANT_OPEN_HOUR` | Hora de apertura (HH:MM) | `19:00` |
| `RESTAURANT_CLOSE_HOUR` | Hora de cierre (HH:MM) | `23:30` |
| `MAX_TABLES` | Cantidad máxima de mesas | `10` |
| `PORT` | Puerto del servidor Express | `3000` |

> `OWNER_PHONE` acepta múltiples valores separados por coma para soportar el ID interno de WhatsApp (LID) junto al número real.

---

## Estructura del Proyecto

```
restaurant-whatsapp-bot/
│
├── src/
│   ├── index.js                 ← Punto de entrada
│   ├── app.js                   ← Servidor Express
│   ├── services/
│   │   ├── whatsapp.js          ← Conexión Baileys y gestión de eventos
│   │   └── flow.js              ← Máquina de estados conversacional
│   ├── database/
│   │   └── supabase.js          ← Queries y operaciones con Supabase
│   └── utils/
│       └── validators.js        ← Validación de fechas y horarios
│
├── database/
│   └── schema.sql               ← SQL para crear la tabla en Supabase
│
├── auth_info_baileys/           ← Sesión de WhatsApp (generada al conectar)
├── .env.example
├── package.json
└── README.md
```

---

## Aspectos Destacados

- Máquina de estados conversacional con **sesiones en memoria** (`Map`) por usuario
- **Reconexión automática** ante caídas de conexión (excepto cierre de sesión manual)
- Notificaciones al dueño enviadas **en segundo plano** (fire-and-forget) para no bloquear la respuesta al cliente
- Soporte de **privacidad de WhatsApp (LID)**: detecta automáticamente si el número está oculto y solicita el teléfono de forma natural dentro del flujo
- Simulación de escritura humana con **3 segundos de delay** antes de cada respuesta
- **Soft delete** en cancelaciones: las reservas se marcan como canceladas en lugar de eliminarse

---

## Posibles Mejoras

- [ ] Menú dinámico cargado desde Supabase en lugar de texto estático
- [ ] Panel web de administración para gestionar reservas visualmente
- [ ] Soporte para múltiples sucursales o zonas horarias
- [ ] Sistema de recordatorios automáticos por WhatsApp antes de la reserva
- [ ] Autenticación de administrador con contraseña secreta por chat
