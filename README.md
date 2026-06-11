# zadarmaserver

Servidor Node.js que recibe webhooks de Zadarma cuando una grabación está lista (`NOTIFY_RECORD`), descarga el MP3 vía API y lo sube a una carpeta de Google Drive.

## Requisitos

- Node.js 18+
- Cuenta Zadarma con PBX y grabación en la nube activada
- Proyecto Google Cloud con Drive API y cuenta de servicio
- VPS con HTTPS (para que Zadarma pueda enviar webhooks)

## Configuración

### 1. Variables de entorno

Copia el ejemplo y rellena los valores:

```bash
cp .env.example .env
```

| Variable | Descripción |
|----------|-------------|
| `ZADARMA_API_KEY` | API Key (Zadarma → Settings → Integrations and API) |
| `ZADARMA_API_SECRET` | API Secret |
| `RECORD_DOWNLOAD_DELAY_MS` | Espera antes de descargar (default: 40000) |
| `GOOGLE_CLIENT_ID` | OAuth2 client ID (Desktop app) |
| `GOOGLE_CLIENT_SECRET` | OAuth2 client secret |
| `GOOGLE_REFRESH_TOKEN` | Refresh token de tu cuenta Gmail |
| `GOOGLE_DRIVE_FOLDER_ID` | ID de la carpeta destino en Drive |
| `PORT` | Puerto del servidor (default: 3000) |

### 2. Zadarma

1. Genera **API Key** y **Secret** en Settings → Integrations and API.
2. Activa **grabación en la nube** en la extensión PBX correspondiente.
3. En **PBX call notifications**, configura la URL:
   ```
   https://tu-dominio.com/webhook/zadarma
   ```
4. Activa el evento **NOTIFY_RECORD**.
5. Zadarma verificará la URL con `GET ?zd_echo=...`; el servidor devuelve el mismo valor.

### 3. Google Drive (OAuth2 — cuenta personal)

Las grabaciones se suben a **tu Drive personal** mediante OAuth2, sin Service Accounts (que no tienen cuota de almacenamiento).

1. En [Google Cloud Console](https://console.cloud.google.com/) crea un proyecto y habilita **Google Drive API**.
2. **APIs & Services → Credentials → Create Credentials → OAuth client ID**. Tipo de aplicación: **Desktop app**. Guarda el JSON como `oauth-client.json` en la raíz del proyecto.
3. Añade tu Gmail como **Test user** en la pantalla de consentimiento (OAuth consent screen → Test users → Add users). Mientras la app esté en modo "Testing" solo los usuarios de prueba pueden autorizar.
4. Genera la URL de autorización:
   ```js
   // generate-url.js
   const fs = require('fs');
   const { google } = require('googleapis');

   const { client_id, client_secret } =
     JSON.parse(fs.readFileSync('./oauth-client.json')).installed;

   const oauth2 = new google.auth.OAuth2(
     client_id, client_secret, 'http://localhost'
   );

   console.log(oauth2.generateAuthUrl({
     access_type: 'offline',
     scope: ['https://www.googleapis.com/auth/drive'],
   }));
   ```
   ```bash
   node generate-url.js
   ```
5. Abre la URL → inicia sesión con tu Gmail → acepta los permisos. Google te redirigirá a `http://localhost/?code=4/0Abc...`. Copia el `code`.
6. Intercambia el `code` por el refresh token:
   ```js
   // get-token.js
   const fs = require('fs');
   const { google } = require('googleapis');

   const { client_id, client_secret } =
     JSON.parse(fs.readFileSync('./oauth-client.json')).installed;

   const oauth2 = new google.auth.OAuth2(
     client_id, client_secret, 'http://localhost'
   );

   const code = 'PEGA_AQUI_EL_CODE';

   (async () => {
     const { tokens } = await oauth2.getToken(code);
     console.log(tokens);
   })();
   ```
   ```bash
   node get-token.js
   ```
7. Copia `refresh_token` a `.env`. **No** borres `oauth-client.json` hasta haber confirmado que todo funciona.
8. Crea la carpeta destino en Drive (ej. `Grabaciones Zadarma`) y copia su ID de la URL: `https://drive.google.com/drive/folders/FOLDER_ID`.

### 4. Despliegue en VPS

```bash
npm install
npm start
```

Ejemplo de reverse proxy con **nginx**:

```nginx
server {
    listen 443 ssl;
    server_name tu-dominio.com;

    ssl_certificate     /etc/letsencrypt/live/tu-dominio.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/tu-dominio.com/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Usa **systemd**, **pm2** o similar para mantener el proceso en ejecución.

## Pruebas

Verificación echo (la misma que hace Zadarma al configurar el webhook):

```bash
curl "https://tu-dominio.com/webhook/zadarma?zd_echo=prueba"
# Debe responder: prueba
```

Health check:

```bash
curl https://tu-dominio.com/
```

Tras una llamada grabada, revisa los logs del servidor y la carpeta de Drive. Si falla la subida, revisa que el `refresh_token` siga siendo válido (los tokens pueden revocarse al cambiar la contraseña o revocar el acceso de la app en https://myaccount.google.com/permissions).

## Flujo

1. Zadarma envía `POST /webhook/zadarma` con `event=NOTIFY_RECORD`.
2. El servidor valida la firma HMAC y responde `200` de inmediato.
3. En segundo plano:
   - Espera ~40 s (`RECORD_DOWNLOAD_DELAY_MS`).
   - Crea las carpetas del día si no existen (`Drive/<root>/YYYY/MM/DD/`).
   - Comprueba si ya hay un archivo con el mismo nombre en la carpeta del día → si está, lo salta (idempotencia).
   - Obtiene el enlace temporal con `/v1/pbx/record/request/`, descarga el MP3 y lo sube a Drive.
   - Borra la grabación de Zadarma.

## Organización en Drive

Las grabaciones se guardan en `GOOGLE_DRIVE_FOLDER_ID` con esta estructura:

```
Grabaciones Zadarma/
├── 2026/
│   ├── 06/
│   │   ├── 05/
│   │   │   ├── 20260605-114530_in_3001234567_to_3007654321_in_7299aab6...mp3
│   │   │   └── 20260605-152210_out_3007654321_to_3001234567_in_abcdef0...mp3
│   │   └── 06/
│   │       └── 20260606-091500_in_3009999999_to_3007654321_in_1234567...mp3
│   └── 07/
│       └── ...
```

- **Carpetas** se crean automáticamente por fecha (hora Colombia, `America/Bogota`).
- **Nombre del archivo**: `YYYYMMDD-HHMMSS_<dir>_<caller>_to_<callee>_<pbxCallId>.mp3`.
  - `<dir>` = `in` (entrante) u `out` (saliente). Si Zadarma no envía `direction`, se omite.
  - `caller` / `callee` se extraen de `caller_id` / `callee_id` del webhook.
  - `<pbxCallId>` es único por llamada, así que reintentos de Zadarma con el mismo `pbx_call_id` se detectan y se saltan.
- **Hora**: la fecha se toma de `call_start` del webhook (timestamp de la llamada) en zona horaria `America/Bogota`. Si no viene, se usa la hora actual.
- **Idempotencia**: si Zadarma reenvía el mismo `pbx_call_id`, la subida se omite y verás `[recording] Ya existe en Drive, saltando ...` en logs.

## Estructura

```
src/
  config/env.js
  routes/zadarmaWebhook.js
  services/zadarma/        # firma, API, pipeline
  services/drive/
    upload.js              # cliente Drive + subida del MP3
    folders.js             # navegación: buscar / crear / asegurar path de fecha
tools/
  generate-url.js          # genera URL de OAuth2 (uso único)
  get-token.js             # intercambia code → refresh_token (uso único)
```
# zadarma
