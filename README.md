# SentinelData

Plataforma web para la gestión de incidentes de ciberseguridad y el análisis de eventos de acceso basado en datos, para **TransLogix Ltda.** (empresa ficticia). Proyecto de Título. Los informes y enunciados están en [documentacion/](documentacion/).

**Entrega 2** (Evaluación Sumativa N°2): API REST con JWT, eventos en tiempo real con Socket.IO, tabla de agregación para el panel, archivado de eventos antiguos y script de particionado.

## Stack

| Capa | Tecnología |
|---|---|
| Servidor | Node.js 22 + Express 4 |
| Vistas | Plantillas EJS 3, HTML5 semántico, CSS3 propio (sin frameworks), JavaScript sin dependencias |
| Base de datos | MySQL 8.4 LTS (14 tablas, 3FN) |
| Seguridad | bcryptjs (costo 12), helmet (CSP, HSTS, X-Frame-Options), express-rate-limit, express-validator, token anti-CSRF propio |
| Sesiones | express-session guardadas en MySQL (tabla `sessions`) |
| Correo | Nodemailer + Mailpit (desarrollo) / SMTP real (producción) |
| Gráficos | Chart.js 4 |
| API REST | Express + JSON, JWT (jsonwebtoken, HS256), OpenAPI 3, errores RFC 7807 |
| Tiempo real | Socket.IO 4 (WebSocket con respaldo de long-polling) |
| Contenedores | Docker + Docker Compose |

## Ejecutar con Docker (recomendado)

Requisito: Docker Desktop.

```bash
docker compose up -d --build
```

| Servicio | URL |
|---|---|
| Aplicación | http://localhost:3000 |
| Mailpit (correos de prueba) | http://localhost:8025 |
| MySQL | localhost:3306 (`sentinel` / `sentinel_dev`) |

Al primer inicio la aplicación crea las tablas y carga los datos de demostración: 121 usuarios, 31 activos, 72 incidentes y más de 50.000 eventos de acceso de los últimos 60 días, con ataques simulados. El primer arranque tarda unos segundos mientras MySQL se inicializa.

### Cuentas de prueba

| Perfil | Correo | Contraseña |
|---|---|---|
| Administrador de seguridad | admin@translogix.cl | Admin#2026 |
| Administrador de seguridad | camila.rojas@translogix.cl | Demo#2026 |
| Colaborador | colaborador@translogix.cl | Demo#2026 |

Los demás usuarios generados también usan `Demo#2026`.

## Ejecutar sin Docker

Requisitos: Node.js 20 o superior, MySQL 8.4 y, opcionalmente, Mailpit.

```bash
cp .env.example .env      # ajustar DB_* y SMTP_*
npm install
npm start                 # crea el esquema y los datos si la base está vacía
```

La base de datos indicada en `DB_NAME` debe existir y el usuario necesita permisos sobre ella (no de administrador del servidor).

## Scripts

| Comando | Descripción |
|---|---|
| `npm start` | Inicia la aplicación |
| `npm run dev` | Inicia con recarga automática |
| `npm run db:reset` | Borra las tablas y vuelve a cargar los datos de demostración (solo desarrollo) |
| `npm run test:e2e` | Pruebas de extremo a extremo del Anexo A (CP-01 a CP-17) contra la app en ejecución |
| `npm run test:api` | Pruebas de la API REST y de Socket.IO (CP-21 a CP-32) |
| `npm run resumen:reconstruir` | Recalcula la tabla agregada `resumen_eventos_hora` |
| `npm run eventos:archivar` | Exporta a `archivo/*.jsonl.gz` y elimina los eventos de más de 12 meses (`--meses N`, `--dias N`, `--simular`) |

Para las pruebas e2e se recomienda partir de una base recién inicializada:

```bash
docker compose exec app node src/db/reset.js
npm run test:e2e
npm run test:api
```

## API REST

Documentación navegable en **http://localhost:3000/api/docs** y especificación OpenAPI 3 en `/api/openapi.json` (importable en Postman).

```bash
# 1. Obtener un token (vigencia 15 min)
curl -X POST http://localhost:3000/api/v1/auth/token \n  -H "Content-Type: application/json" \n  -d '{"email":"admin@translogix.cl","password":"Admin#2026"}'

# 2. Usarlo
curl http://localhost:3000/api/v1/incidentes?estado=1 -H "Authorization: Bearer <access_token>"
```

| Método | Ruta | Perfil |
|---|---|---|
| POST | `/api/v1/auth/token` | Público (con límite de solicitudes) |
| GET | `/api/v1/me`, `/api/v1/catalogos` | Ambos |
| GET, POST | `/api/v1/incidentes` | Ambos (el colaborador solo ve los suyos) |
| GET | `/api/v1/incidentes/{id}` | Ambos (autorización por registro) |
| POST | `/api/v1/incidentes/{id}/seguimientos` | Ambos (solo el administrador cambia estado) |
| GET | `/api/v1/activos` | Ambos |
| POST, PUT | `/api/v1/activos`, `/api/v1/activos/{id}` | Administrador |
| GET, PATCH | `/api/v1/alertas`, `/api/v1/alertas/{id}` | Administrador |
| GET | `/api/v1/eventos` (paginación por cursor) | Administrador |
| GET | `/api/v1/metricas/panel` | Administrador |

## Tiempo real

Socket.IO comparte la sesión del navegador (o recibe un JWT en `auth.token`). Los administradores ven aparecer al instante las alertas nuevas, los eventos de acceso (en `/admin/eventos`) y los incidentes reportados, con los indicadores del panel actualizados. El colaborador recibe un aviso cuando cambia el estado de su incidente. La lista de eventos está en `/api/docs`.

## Estructura

```
├── db/schema.sql              Modelo relacional (14 tablas + resumen agregado) y catálogos
├── db/particionado.sql        Particionado mensual de eventos (escenario de alto volumen, opcional)
├── docker-compose.yml         App + MySQL 8.4 + Mailpit
├── Dockerfile
├── documentacion/             Informe del proyecto y plantillas
├── public/
│   ├── css/styles.css         Estilos propios (mobile-first, 3 puntos de quiebre)
│   └── js/                    Validación, fortaleza de contraseña, menú móvil, gráficos
├── src/
│   ├── server.js              Arranque: espera a MySQL, crea el esquema, carga datos
│   ├── app.js                 Express, cabeceras de seguridad, sesiones, rutas
│   ├── api/                   API REST v1, OpenAPI, autenticación JWT, errores RFC 7807
│   ├── validators.js          Reglas de validación compartidas por web y API
│   ├── config.js              Configuración desde variables de entorno
│   ├── db/                    Pool, inicialización, datos de demostración, reset, archivado
│   ├── middleware/            Autenticación por perfil, CSRF, mensajes flash
│   ├── routes/                auth, panel, incidentes, activos, perfil, admin
│   ├── services/              Lógica de negocio (incidentes, activos, métricas, monitoreo),
│   │                          autenticación, tokens, detección, tiempo real, resumen, correo
│   ├── utils/                 Validación y formato
│   └── views/                 Plantillas EJS
├── tests/e2e.js               Pruebas del Anexo A (interfaz web)
└── tests/api.js               Pruebas de API REST y Socket.IO
```

## Trazabilidad con el informe

### Requerimientos funcionales

| Req. | Implementación |
|---|---|
| RF-01 Inicio de sesión | [src/routes/auth.js](src/routes/auth.js) `POST /login` |
| RF-02 Registro | `POST /registro`, perfil Colaborador, política de uso |
| RF-03 Recuperación | `POST /recuperar`, token de 256 bits guardado como SHA-256, 30 min, un solo uso |
| RF-04 Bloqueo | 5 intentos fallidos → 15 min; desbloqueo por administrador o por recuperación |
| RF-05 Perfil | [src/routes/perfil.js](src/routes/perfil.js) |
| RF-06 Reporte de incidente (formulario 1) | [src/routes/incidentes.js](src/routes/incidentes.js) `POST /incidentes`, código `INC-AAAA-NNNNN` |
| RF-07 Listado con filtros | `GET /incidentes`; el colaborador solo ve los suyos |
| RF-08 Detalle y línea de tiempo | `GET /incidentes/:id` con SLA según severidad |
| RF-09 Seguimiento (formulario 3) | `POST /incidentes/:id/seguimientos` |
| RF-10/11 Activos (formulario 2) | [src/routes/activos.js](src/routes/activos.js) |
| RF-12 Registro de eventos | [src/services/eventos.js](src/services/eventos.js) |
| RF-13 Reglas de detección | [src/services/deteccion.js](src/services/deteccion.js): FUERZA_BRUTA, IP_SOSPECHOSA (≥10 fallos contra ≥3 cuentas en 15 min), IP_NUEVA (90 días), FUERA_HORARIO |
| RF-14 Alertas | `GET /admin/alertas`, marcar como revisada |
| RF-15 Eventos con filtros | `GET /admin/eventos` (tipo, correo, IP, fechas, paginación) |
| RF-16 Panel analítico | [src/services/metricas.js](src/services/metricas.js) (lee `resumen_eventos_hora`) + [public/js/panel.js](public/js/panel.js) |
| RF-17 Usuarios | [src/routes/admin.js](src/routes/admin.js) |
| RF-18 Panel del colaborador | Incidentes propios y últimos accesos |

### Requerimientos no funcionales de seguridad

| Req. | Implementación |
|---|---|
| RNF-01 | `bcryptjs`, costo 12 (`BCRYPT_COST`) |
| RNF-02 | Todas las consultas con parámetros `?` ([src/db/pool.js](src/db/pool.js)) |
| RNF-03 | Token anti-CSRF por sesión ([src/middleware/csrf.js](src/middleware/csrf.js)); cookie `HttpOnly`, `SameSite=Lax`, `Secure` en producción; expiración a los 30 min de inactividad; sesión regenerada al iniciar sesión |
| RNF-04 | Validación en cliente ([public/js/app.js](public/js/app.js)) y servidor (express-validator); EJS escapa las salidas; CSP sin scripts en línea; rate limit en `/login`, `/registro` y `/recuperar` |
| RNF-05 | Mensajes genéricos en login y recuperación; comparación bcrypt también cuando el correo no existe |
| RNF-06 | Índices compuestos, tabla agregada `resumen_eventos_hora` y paginación por cursor en la API |
| RNF-07 | CSS propio mobile-first; menú desplegable y tablas como tarjetas bajo 600 px |
| RNF-10 | Capas (rutas web y API → servicios → acceso a datos), configuración por variables de entorno, Docker |
| RNF-11 | Archivado a JSON Lines comprimido ([src/db/archivar.js](src/db/archivar.js)) y particionado mensual ([db/particionado.sql](db/particionado.sql)) |

## Despliegue en producción (OE6)

1. Crear una base MySQL 8 administrada y un servicio de contenedores (Railway, Render u otro).
2. Definir las variables de [.env.example](.env.example) con `NODE_ENV=production`, `SESSION_SECRET` y `JWT_SECRET` largos, aleatorios y distintos, `APP_URL` con la URL pública HTTPS y `TRUST_PROXY=1`, porque el proveedor termina HTTPS en su proxy.
3. Configurar SMTP real (Gmail con contraseña de aplicación, o Brevo), con `SMTP_SECURE=true` si se usa el puerto 465.
4. Usar `SEED_DEMO=false` si no se quieren datos de demostración.
