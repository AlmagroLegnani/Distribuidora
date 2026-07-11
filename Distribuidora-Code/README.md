# StockApp — SaaS Multi-Tenant: Stock & Pedidos

Plataforma SaaS de gestión de stock y pedidos con arquitectura multi-tenant.

## Estructura del Proyecto

```
/
├── apps/
│   ├── web/          → Next.js 14 — Portal del cliente final + signup público (puerto 3000)
│   ├── admin/        → Next.js 14 — Backoffice del distribuidor (puerto 3002)
│   └── superadmin/   → Next.js 14 — Panel de la plataforma (dueño del SaaS) (puerto 3003)
├── packages/
│   ├── api/          → Node.js + Express — API REST  (puerto 3001)
│   ├── db/           → Prisma ORM + PostgreSQL
│   └── shared/       → Tipos TypeScript compartidos
├── docker-compose.yml
└── README.md
```

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
- **API**: http://localhost:3001
- **Portal cliente / signup**: http://localhost:3000
- **Backoffice admin**: http://localhost:3002
- **Panel de plataforma (super-admin)**: http://localhost:3003

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
| Distribuidor demo     | demo@stockapp.com    | demo1234       | http://localhost:3002 (backoffice) / http://localhost:3000/demo (catálogo, código `DEMO2024`) |
| Administrador de plataforma | admin@stockapp.com | platform1234 | http://localhost:3003 |

---

## URLs de la Aplicación

| App      | URL                             | Descripción                      |
|----------|---------------------------------|----------------------------------|
| Portal   | `http://localhost:3000/[slug]`  | Catálogo + carrito del cliente   |
| Signup   | `http://localhost:3000/signup`  | Alta pública de nuevas distribuidoras (prueba gratis + MercadoPago) |
| Backoffice | `http://localhost:3002`       | Panel del distribuidor           |
| Panel de plataforma | `http://localhost:3003` | Gestión de distribuidoras, planes y pagos (dueño del SaaS) |
| API      | `http://localhost:3001/api`     | REST API                         |
| API Health | `http://localhost:3001/health` | Estado del servidor             |

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
| POST   | `/api/signup`         | Crea distribuidora + prueba gratis de 7 días + link de pago MercadoPago |

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
| `MERCADOPAGO_ACCESS_TOKEN` | Access token de MercadoPago para cobrar suscripciones. Sin esto, el signup sigue creando cuentas en prueba gratuita pero no genera el checkout | ❌ (recomendada) |
| `PLATFORM_URL`        | URL pública del portal cliente (`apps/web`), usada en los `back_urls` de MercadoPago | ❌ |
| `API_PUBLIC_URL`      | URL pública de la API, usada como `notification_url` del webhook de MercadoPago (debe ser accesible desde internet en producción) | ❌ |
| `ADMIN_URL`           | URL del backoffice (`apps/admin`), usada en el link de "recuperar contraseña" | ❌ |
| `NEXT_PUBLIC_API_URL` | URL de la API (para frontend)        | ✅        |
| `ALLOWED_ORIGINS`     | Orígenes CORS (separados por coma), incluye el panel de plataforma | ❌        |

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

Para los frontends en producción, despliega `apps/admin` y `apps/web` en Vercel, Netlify u otro proveedor Next.js y configura `NEXT_PUBLIC_API_URL` apuntando a tu API en producción.

---

## Modelo de Negocio SaaS

- **Planes**: se administran desde el panel de plataforma (`/plans`). Cada plan define precio mensual y límites (`maxProducts`, `maxClients`, `maxOrdersMonth`; `null` = ilimitado).
- **Alta de una distribuidora**: `apps/web/signup` → elige plan → se crea con 7 días de prueba gratis (`TRIALING`, acceso inmediato) y se genera un checkout de MercadoPago para configurar el pago.
- **Cobro**: MercadoPago Checkout Pro. El webhook (`/api/webhooks/mercadopago`) confirma el pago, activa la suscripción (`ACTIVE`) y extiende el período 30 días.
- **Vencimiento y gracia**: si no hay pago antes de que termine el período, la suscripción pasa a `PAST_DUE` con 5 días de gracia; luego a `SUSPENDED` (se bloquea el login del distribuidor y su catálogo público). Esta verificación es *lazy* (se recalcula en cada login o vista del panel de plataforma), no hay un cron real corriendo.
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
- **Dockerfiles de `apps/web`, `apps/admin` y `apps/superadmin`** — solo `packages/api` tiene Dockerfile hoy; el resto se despliega en Vercel/Netlify o se dockeriza aparte.
- **Almacenamiento de imágenes** (S3/Cloudinary) — hoy `imageUrl` es pegar un link.
- **Carga masiva de productos** (CSV/Excel).
- **Roles múltiples por distribuidora** (hoy es un solo usuario/login por tenant).
- **Monitoreo y logs** (Sentry, Datadog, o similar) — hoy solo hay `console.log`/`console.error`.
- **Tests automatizados y CI** — `jest` está configurado en `packages/api` pero no hay tests escritos.
