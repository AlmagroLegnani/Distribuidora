# StockApp — SaaS Multi-Tenant: Stock & Pedidos

Plataforma SaaS de gestión de stock y pedidos con arquitectura multi-tenant.

## Estructura del Proyecto

```
/
├── apps/
│   ├── web/          → Next.js 14 — Portal del cliente final  (puerto 3000)
│   └── admin/        → Next.js 14 — Backoffice del distribuidor (puerto 3002)
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
- **Portal cliente**: http://localhost:3000
- **Backoffice admin**: http://localhost:3002

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

| Campo    | Valor                |
|----------|----------------------|
| Email    | demo@stockapp.com    |
| Password | demo1234             |
| Portal   | http://localhost:3000/demo |
| Admin    | http://localhost:3002 |

---

## URLs de la Aplicación

| App      | URL                             | Descripción                      |
|----------|---------------------------------|----------------------------------|
| Portal   | `http://localhost:3000/[slug]`  | Catálogo + carrito del cliente   |
| Backoffice | `http://localhost:3002`       | Panel del distribuidor           |
| API      | `http://localhost:3001/api`     | REST API                         |
| API Health | `http://localhost:3001/health` | Estado del servidor             |

---

## API Endpoints

### Autenticación
| Método | Ruta                         | Descripción             |
|--------|------------------------------|-------------------------|
| POST   | `/api/auth/login`            | Login distribuidor      |
| POST   | `/api/auth/logout`           | Logout                  |
| GET    | `/api/auth/me`               | Perfil autenticado      |
| POST   | `/api/auth/change-password`  | Cambiar contraseña      |
| PUT    | `/api/auth/settings`         | Guardar configuración   |

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
| `NEXT_PUBLIC_API_URL` | URL de la API (para frontend)        | ✅        |
| `ALLOWED_ORIGINS`     | Orígenes CORS (separados por coma)   | ❌        |

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

## Arquitectura Multi-Tenant

El aislamiento de datos se garantiza mediante:

1. **`distributorId` en cada entidad**: Products, Clients, Orders todos tienen `distributorId`.
2. **Middleware de autenticación**: Inyecta `req.distributorId` desde el JWT en cada request autenticado.
3. **Servicios con scope**: Cada función de servicio recibe y filtra por `distributorId`.
4. **Portal público por slug**: El slug del distribuidor es el identificador de URL, mapeado internamente a `distributorId`.

---

## Seguridad

- Contraseñas hasheadas con **bcrypt** (10 rounds)
- JWT con expiración configurable
- Helmet para headers HTTP seguros
- CORS configurado por origen
- Validación de inputs con **Zod** en todos los endpoints
- Transacciones Prisma para operaciones de stock (previene race conditions)
- Soft-delete (nunca se eliminan datos permanentemente)
