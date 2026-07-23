# StockApp — SaaS Multi-Tenant: Stock & Pedidos

Plataforma SaaS de gestión de stock y pedidos con arquitectura multi-tenant.

## Estructura del Proyecto

```
/
├── apps/
│   └── web/          → Next.js 16 — App unificada (puerto 3000)
│                        /            → landing pública
│                        /[slug]      → catálogo del cliente
│                        /admin/*     → backoffice del distribuidor
│                        /platform/*  → panel de la plataforma (dueño del SaaS)
├── packages/
│   ├── api/          → Node.js + Express — API REST  (puerto 3001, interno)
│   ├── db/           → Prisma ORM + PostgreSQL
│   └── shared/       → Tipos TypeScript compartidos
├── docker-compose.yml
└── README.md
```

`apps/admin` y `apps/superadmin` existieron como apps de Next.js separadas (puertos 3002/3003)
hasta que se unificaron dentro de `apps/web`. El backend (`packages/api`, puerto 3001) sigue
corriendo aparte, pero ya no se accede directo desde el navegador — `apps/web` lo reenvía vía
`rewrites` de Next.js (ver `apps/web/next.config.js` e `INTERNAL_API_URL`).

## Requisitos Previos

- Node.js 18+
- npm 9+ (o Yarn / pnpm)
- PostgreSQL 14+ (o Docker)

---

## Instalación Rápida (con Docker)

### 1. Clonar y configurar variables de entorno

```bash
cp .env.example .env
# Editar .env con tus valores (JWT_SECRET obligatorio)
```

### 2. Levantar la base de datos

```bash
docker-compose up db -d
```

### 3. Instalar dependencias

```bash
npm install
```

### 4. Configurar Prisma y base de datos

```bash
# Generar el cliente Prisma
npm run db:generate

# Ejecutar migraciones
npm run db:migrate

# Cargar datos de prueba
npm run db:seed
```

### 5. Iniciar todos los servicios en desarrollo

```bash
npm run dev
```

Esto levanta en paralelo:
- **API** (interna): http://localhost:3001
- **App unificada**: http://localhost:3000 — landing pública, catálogo (`/[slug]`), backoffice del
  distribuidor (`/admin`) y panel de plataforma (`/platform`)

---

## Instalación Sin Docker

Necesitas PostgreSQL corriendo localmente. Edita `DATABASE_URL` en `.env`:

```env
DATABASE_URL="postgresql://tu_usuario:tu_password@localhost:5432/stockapp"
```

Luego sigue los pasos 3–5 del apartado anterior.

---

## Credenciales de Demo

Tras ejecutar el seed:

| Rol                  | Email               | Password       | URL                          |
|----------------------|----------------------|----------------|-------------------------------|
| Distribuidor demo     | demo@stockapp.com    | demo1234       | http://localhost:3000/login (backoffice) / http://localhost:3000/demo (catálogo, código `DEMO2024`) |
| Administrador de plataforma | admin@stockapp.com | platform1234 | http://localhost:3000/platform-login |

---

## URLs de la Aplicación

| Ruta      | URL                             | Descripción                      |
|----------|---------------------------------|----------------------------------|
| Landing  | `http://localhost:3000/`        | Home pública                     |
| Portal   | `http://localhost:3000/[slug]`  | Catálogo + carrito del cliente   |
| Backoffice | `http://localhost:3000/admin` | Panel del distribuidor (login en `/login`) |
| Panel de plataforma | `http://localhost:3000/platform` | Gestión de distribuidoras, planes y pagos (dueño del SaaS, login en `/platform-login`) |
| API (interna) | `http://localhost:3001/api` | REST API — el navegador la llama vía `/api/*` en el mismo origen (3000), nunca directo |
| API Health | `http://localhost:3001/health` | Estado del servidor (también proxeado en `/health`) |

Nota: el autoregistro público de distribuidoras está cerrado — se dan de alta manualmente desde
`/platform` (ver "Modelo de Negocio SaaS" más abajo). La sección de Endpoints de abajo aún
menciona el signup público (`/api/signup`) por compatibilidad histórica del código, pero esa
ruta pública ya no está en uso.

---

## API Endpoints

### Autenticación
| Método | Ruta                         | Descripción             |
|--------|------------------------------|-------------------------|
| POST   | `/api/auth/login`            | Login distribuidor      |
| POST   | `/api/auth/logout`           | Logout                  |
| POST   | `/api/auth/forgot-password`  | Solicitar recuperación de contraseña |
| POST   | `/api/auth/reset-password`   | Restablecer contraseña con token |
| GET    | `/api/auth/me`               | Perfil autenticado (incluye suscripción) |
| POST   | `/api/auth/change-password`  | Cambiar contraseña      |
| PUT    | `/api/auth/settings`         | Guardar configuración   |
| PUT    | `/api/auth/access-code`      | Configurar código de acceso al catálogo |
| POST   | `/api/auth/billing/checkout` | Generar link de pago MercadoPago (pagar/renovar) |

### Signup público de distribuidoras
| Método | Ruta                  | Descripción                                   |
|--------|-----------------------|------------------------------------------------|
| GET    | `/api/signup/plans`   | Planes activos disponibles para elegir          |
| POST   | `/api/signup`         | Crea distribuidora + 3 meses de prueba gratis (sin checkout, el pago se acuerda por contrato) |

### Plataforma / super-admin (requiere JWT de plataforma)
| Método | Ruta                                       | Descripción                          |
|--------|---------------------------------------------|---------------------------------------|
| POST   | `/api/platform/auth/login`                  | Login del administrador de plataforma |
| GET    | `/api/platform/distributors`                | Listar todas las distribuidoras + estado de suscripción |
| GET    | `/api/platform/distributors/:id`            | Detalle + historial de pagos          |
| PATCH  | `/api/platform/distributors/:id/suspend`    | Suspender acceso                      |
| PATCH  | `/api/platform/distributors/:id/activate`   | Reactivar acceso                      |
| POST   | `/api/platform/distributors/:id/mark-paid`  | Registrar pago manual (transferencia/efectivo) |
| GET/POST/PUT | `/api/platform/plans`, `/api/platform/plans/:id` | CRUD de planes comerciales |

### Webhooks
| Método | Ruta                          | Descripción                                  |
|--------|-------------------------------|-----------------------------------------------|
| POST   | `/api/webhooks/mercadopago`   | Notificación de pago — activa/extiende la suscripción |

### Productos (requiere JWT)
| Método | Ruta                            | Descripción          |
|--------|---------------------------------|----------------------|
| GET    | `/api/products`                 | Listar productos     |
| POST   | `/api/products`                 | Crear producto       |
| PUT    | `/api/products/:id`             | Editar producto      |
| DELETE | `/api/products/:id`             | Soft-delete          |
| PATCH  | `/api/products/:id/stock`       | Actualizar stock     |

### Clientes (requiere JWT)
| Método | Ruta                | Descripción       |
|--------|---------------------|-------------------|
| GET    | `/api/clients`      | Listar clientes   |
| POST   | `/api/clients`      | Crear cliente     |
| PUT    | `/api/clients/:id`  | Editar cliente    |
| DELETE | `/api/clients/:id`  | Desactivar cliente|

### Pedidos (requiere JWT)
| Método | Ruta                           | Descripción           |
|--------|--------------------------------|-----------------------|
| GET    | `/api/orders`                  | Listar pedidos        |
| GET    | `/api/orders/dashboard`        | Stats del dashboard   |
| GET    | `/api/orders/:id`              | Detalle de pedido     |
| PATCH  | `/api/orders/:id/status`       | Cambiar estado        |

### Portal Público
| Método | Ruta                                | Descripción                     |
|--------|-------------------------------------|---------------------------------|
| GET    | `/api/public/:slug`                 | Info del distribuidor           |
| GET    | `/api/public/:slug/products`        | Catálogo (stock > 0)            |
| GET    | `/api/public/:slug/client/:rut`     | Buscar cliente por RUT          |
| POST   | `/api/public/:slug/orders`          | Crear pedido                    |

---

## Variables de Entorno

Copia `.env.example` a `.env` y configura:

| Variable              | Descripción                          | Requerida |
|-----------------------|--------------------------------------|-----------|
| `DATABASE_URL`        | URL de conexión PostgreSQL           | ✅        |
| `JWT_SECRET`          | Secreto para firmar tokens JWT       | ✅        |
| `JWT_EXPIRES_IN`      | Duración del token (default: `7d`)   | ❌        |
| `SMTP_HOST`           | Host del servidor SMTP               | ❌        |
| `SMTP_PORT`           | Puerto SMTP (default: `587`)         | ❌        |
| `SMTP_USER`           | Usuario SMTP                         | ❌        |
| `SMTP_PASS`           | Contraseña SMTP                      | ❌        |
| `EMAIL_FROM`          | Dirección de origen de emails        | ❌        |
| `TWILIO_ACCOUNT_SID`  | SID de cuenta Twilio (WhatsApp)      | ❌        |
| `TWILIO_AUTH_TOKEN`   | Token de Twilio                      | ❌        |
| `TWILIO_WHATSAPP_FROM`| Número Twilio WhatsApp sender        | ❌        |
| `MERCADOPAGO_ACCESS_TOKEN` | Access token de MercadoPago para cobrar suscripciones. Sin esto, no se genera el link de pago/checkout | ❌ (recomendada) |
| `PLATFORM_URL`        | URL pública de la app unificada (`apps/web`), usada en los `back_urls` de MercadoPago y en el link de "recuperar contraseña" | ❌ |
| `API_PUBLIC_URL`      | URL pública de la API, usada como `notification_url` del webhook de MercadoPago (debe ser accesible desde internet en producción) | ❌ |
| `INTERNAL_API_URL`    | URL interna de la API, usada solo del lado del servidor por `apps/web` (rewrites + fetch en Server Components) para reenviar `/api/*` y `/health` | ❌ (default `http://localhost:3001`) |
| `ALLOWED_ORIGINS`     | Orígenes CORS (separados por coma) | ❌        |

---

## Scripts Disponibles

```bash
npm run dev          # Inicia todos los servicios en modo desarrollo
npm run build        # Compila todos los paquetes
npm run test         # Ejecuta tests

npm run db:generate  # Genera el cliente Prisma
npm run db:migrate   # Ejecuta migraciones pendientes
npm run db:seed      # Carga datos de prueba
npm run db:studio    # Abre Prisma Studio (GUI de base de datos)
npm run db:reset     # Resetea la base de datos (¡BORRA DATOS!)
```

---

## Producción con Docker

```bash
# Levantar base de datos + API
docker-compose up -d

# Ver logs
docker-compose logs -f api
```

Para el frontend en producción, despliega `apps/web` en Vercel, Netlify u otro proveedor Next.js y configura `INTERNAL_API_URL` apuntando a tu API en producción (la usa el servidor de Next.js para los `rewrites` de `/api/*`).

---

## Modelo de Negocio SaaS

- **Planes**: se administran desde el panel de plataforma (`/plans`). Cada plan define precio mensual y límites (`maxProducts`, `maxClients`, `maxOrdersMonth`; `null` = ilimitado).
- **Alta de una distribuidora**: `apps/web/signup` → elige plan → se crea con 3 meses de prueba gratis (`TRIALING`, acceso inmediato), sin pedir pago ni generar checkout. La prueba gratuita se acuerda de palabra con el dueño de la distribuidora; después se firma un contrato para el pago mensual.
- **Cobro**: manual, según lo acordado por contrato (transferencia, efectivo, etc.). El panel de plataforma permite marcar un período como pagado (`mark-paid`) para extender el acceso 30 días. El checkout de MercadoPago sigue disponible como opción de autoservicio desde Configuración (`/auth/billing/checkout`) para el distribuidor que quiera pagar online, pero ya no es parte obligatoria del alta.
- **Vencimiento y gracia**: si no hay pago (manual o vía MercadoPago) antes de que termine el período, la suscripción pasa a `PAST_DUE` con 5 días de gracia; luego a `SUSPENDED` (se bloquea el login del distribuidor y su catálogo público). Esta verificación es *lazy* (se recalcula en cada login o vista del panel de plataforma), no hay un cron real corriendo.
- **Límites de plan**: se validan al crear productos, clientes y pedidos (`subscriptionService.assertWithinLimit`), devolviendo error 403 con un mensaje claro cuando se alcanza el límite.
- **Pagos manuales**: el panel de plataforma permite marcar un período como pagado manualmente (transferencia, efectivo), independientemente de MercadoPago.
- **Distribuidoras provisionadas manualmente** (como la demo del seed) no tienen fila de `Subscription` y no están sujetas a límites ni auto-suspensión — su `active` se administra directamente.

---

## Arquitectura Multi-Tenant

El aislamiento de datos se garantiza mediante:

1. **`distributorId` en cada entidad**: Products, Clients, Orders todos tienen `distributorId`.
2. **Middleware de autenticación**: Inyecta `req.distributorId` desde el JWT en cada request autenticado.
3. **Servicios con scope**: Cada función de servicio recibe y filtra por `distributorId`.
4. **Portal público por slug**: El slug del distribuidor es el identificador de URL, mapeado internamente a `distributorId`.

---

## Seguridad

- Contraseñas hasheadas con **bcrypt** (10 rounds)
- JWT con expiración configurable — tokens de distribuidor y de plataforma llevan un claim de rol distinto, así uno no sirve para el otro
- Recuperación de contraseña con token de un solo uso (expira a los 30 minutos)
- Rate limiting (`express-rate-limit`) en login, forgot-password, signup y creación pública de pedidos
- Helmet para headers HTTP seguros
- CORS configurado por origen
- Validación de inputs con **Zod** en todos los endpoints
- Transacciones Prisma para operaciones de stock (previene race conditions)
- Soft-delete (nunca se eliminan datos permanentemente)
- Paginación opcional (`?page=&pageSize=`, header `X-Total-Count`) en listados de productos, clientes y pedidos

---

## Pendiente / Fuera de alcance de esta iteración

Para llevar esto a producción real todavía falta, y requiere decisiones o credenciales tuyas:

- **Credenciales reales de MercadoPago** (hoy el signup funciona con prueba gratis, pero el checkout no se genera sin `MERCADOPAGO_ACCESS_TOKEN`; probar el webhook en local requiere `ngrok` u otro túnel).
- **Dockerfile de `apps/web`** — solo `packages/api` tiene Dockerfile hoy; `apps/web` se despliega en Vercel/Netlify o se dockeriza aparte.
- **Almacenamiento de imágenes** (S3/Cloudinary) — hoy `imageUrl` es pegar un link.
- **Carga masiva de productos** (CSV/Excel).
- **Roles múltiples por distribuidora** (hoy es un solo usuario/login por tenant).
- **Monitoreo y logs** (Sentry, Datadog, o similar) — hoy solo hay `console.log`/`console.error`.
- **Tests automatizados y CI** — `jest` está configurado en `packages/api` pero no hay tests escritos.
