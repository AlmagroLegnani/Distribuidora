import { z } from 'zod';
import { URUGUAY_DEPARTMENTS } from '../lib/uruguayDepartments';
import { validateRUT, validateCedula } from '../lib/document';

// ─── Auth ──────────────────────────────────────────────────────────────────
export const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
});

// ─── Product ──────────────────────────────────────────────────────────────
export const createProductSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  code: z.string().max(50).optional().nullable(),
  brand: z.string().max(100).optional().nullable(),
  description: z.string().max(1000).optional().nullable(),
  price: z.number().positive('Price must be positive'),
  // Tasa de IVA de Uruguay ya incluida en `price`. Básica (22%) por defecto,
  // que es la que aplica a la mayoría de los productos.
  ivaType: z.enum(['BASICA', 'MINIMA']).optional().default('BASICA'),
  stock: z.number().int().min(0, 'Stock cannot be negative'),
  category: z.string().max(100).optional().nullable(),
  imageUrl: z.string().url().optional().nullable(),
  active: z.boolean().optional().default(true),
  // Promoción "de fábrica" (ej: regalo, 2x1) — el texto es obligatorio recién
  // cuando promotionActive va en true, eso se valida en productService (no
  // acá) porque createProductSchema.partial() se reusa para el update y no
  // queremos que un .refine() rompa esa composición.
  promotionActive: z.boolean().optional().default(false),
  promotionText: z.string().max(300).optional().nullable(),
  promotionEndDate: z.coerce.date().optional().nullable(),
});

export const updateProductSchema = createProductSchema.partial();

export const updateStockSchema = z.object({
  stock: z.number().int().min(0, 'Stock cannot be negative'),
});

export const setClientDiscountSchema = z.object({
  productId: z.string().cuid('Invalid product ID'),
  // Porcentaje de descuento (ej. 5 = 5% menos). La validación de rango
  // (entre 0 y 100, sin incluir) se hace en el servicio.
  discountPercent: z.number(),
});

// ─── Client ───────────────────────────────────────────────────────────────
// El cliente puede escribir el RUT/Cédula con o sin puntos y guion (ej.
// "1.234.567-8" o "12345678") — se limpia a solo dígitos antes de validar
// el largo, así ninguno de los dos formatos se rechaza por error.
const onlyDigits = (val: unknown): unknown => (typeof val === 'string' ? val.replace(/\D/g, '') : val);

// A client must have at least a RUT or a Cédula (small almacenes often only
// have the latter) — enforced below with .refine(), and at the DB level with
// a CHECK constraint (see packages/db/prisma/migrations).
const clientBaseSchema = z.object({
  rut: z.preprocess(
    onlyDigits,
    z
      .string()
      .min(7, 'RUT inválido')
      .max(12)
      .optional()
      .nullable()
      .refine((val) => !val || validateRUT(val), {
        message: 'El RUT ingresado no es válido (dígito verificador incorrecto)',
      })
  ),
  cedula: z.preprocess(
    onlyDigits,
    z
      .string()
      .min(7, 'Cédula inválida')
      .max(8)
      .optional()
      .nullable()
      .refine((val) => !val || validateCedula(val), {
        message: 'La Cédula ingresada no es válida (dígito verificador incorrecto)',
      })
  ),
  name: z.string().max(200).optional().nullable(),
  email: z.string().email('El email es obligatorio para poder enviar el código de acceso'),
  phone: z.string().max(20).optional().nullable(),
  address: z.string().max(300).optional().nullable(),
});

export const createClientSchema = clientBaseSchema.refine(
  (data) => Boolean(data.rut?.trim()) || Boolean(data.cedula?.trim()),
  { message: 'Debes ingresar el RUT o la Cédula del cliente', path: ['rut'] }
);

// A diferencia de antes, sí se puede editar el RUT/Cédula acá (antes se
// omitían por completo, era imposible corregir un error de tipeo sin
// desactivar y recargar el cliente entero). `.partial()` hace que todos los
// campos sean opcionales — es una edición parcial, no hace falta repetir
// "al menos uno de los dos" en cada guardado.
export const updateClientSchema = clientBaseSchema.partial();

// ─── Order ────────────────────────────────────────────────────────────────
export const orderStatusSchema = z.object({
  status: z.enum(['PENDING', 'PROCESSING', 'COMPLETED', 'CANCELLED']),
  // Solo tienen sentido cuando status es PROCESSING, pero se validan acá
  // igual para cualquier request — el servicio decide si los guarda o no.
  // Fecha en formato "YYYY-MM-DD" (input type=date); hora como texto libre
  // (ej. "14:30") ya que es opcional e independiente de la fecha.
  estimatedDeliveryDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha inválido')
    .optional()
    .or(z.literal('')),
  estimatedDeliveryTime: z.string().max(20).optional().or(z.literal('')),
});

// ─── Public order creation ─────────────────────────────────────────────────
export const createPublicOrderSchema = z.object({
  documento: z.preprocess(onlyDigits, z.string().min(7, 'RUT o Cédula es obligatorio').max(12)),
  clientName: z.string().max(200).optional(),
  clientEmail: z.string().email().optional().nullable(),
  clientPhone: z.string().max(20).optional().nullable(),
  notes: z.string().max(500).optional(),
  items: z
    .array(
      z.object({
        productId: z.string().cuid('Invalid product ID'),
        quantity: z.number().int().positive('Quantity must be a positive integer'),
      })
    )
    .min(1, 'Order must have at least one item'),
});

// ─── Platform (super-admin) ─────────────────────────────────────────────────
export const createPlanSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z
    .string()
    .min(1)
    .max(50)
    .regex(/^[a-z0-9-]+$/, 'Slug must be lowercase letters, numbers and dashes'),
  price: z.number().min(0),
  currency: z.string().max(10).optional().default('UYU'),
  maxProducts: z.number().int().positive().nullable().optional(),
  maxClients: z.number().int().positive().nullable().optional(),
  maxOrdersMonth: z.number().int().positive().nullable().optional(),
  active: z.boolean().optional().default(true),
});

export const updatePlanSchema = createPlanSchema.partial();

export const markPaidSchema = z.object({
  amount: z.number().positive().optional(),
  note: z.string().max(500).optional(),
});

// Cambia el plan/monto de una distribuidora ya existente — pensado para
// reclasificarla entre los tiers de tamaño (Pequeña/Mediana/Grande) cuando
// crece o achica, o para pasarla a un plan con un monto negociado aparte.
export const changeDistributorPlanSchema = z.object({
  planId: z.string().cuid('Invalid plan ID'),
});

// ─── Alta de distribuidora por la plataforma ─────────────────────────────────
// Ya no hay autoregistro público: el equipo de TuStockApp carga la distribuidora
// desde el panel de superadmin. El sistema genera un código de acceso único y
// se lo envía por email — ese código funciona como su contraseña inicial (ver
// platformService.createDistributor).
//
// Rutas top-level reservadas por la app unificada (apps/web) — un slug igual
// a cualquiera de estas rompería el routing, ya sea porque Next.js resuelve
// esa ruta estática antes que /[slug], o porque un rewrite intercepta el
// pedido antes de llegar al router (api, health).
const RESERVED_SLUGS = [
  'admin',
  'platform',
  'platform-login',
  'login',
  'forgot-password',
  'reset-password',
  'distribuidoras',
  'contacto',
  'signup',
  'api',
  'health',
  'impersonate',
];

export const createDistributorSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  email: z.string().email('Invalid email format'),
  slug: z
    .string()
    .min(3, 'Slug must be at least 3 characters')
    .max(50)
    .regex(/^[a-z0-9-]+$/, 'Slug must be lowercase letters, numbers and dashes')
    .refine((slug) => !RESERVED_SLUGS.includes(slug), {
      message: 'Ese identificador de URL está reservado por el sistema, elegí otro',
    }),
  phone: z.string().min(1, 'El teléfono es obligatorio').max(20),
  // Igual que en Client: opcional, uno u otro, se limpia a solo dígitos.
  rut: z.preprocess(
    onlyDigits,
    z
      .string()
      .min(7, 'RUT inválido')
      .max(12)
      .optional()
      .nullable()
      .refine((val) => !val || validateRUT(val), {
        message: 'El RUT ingresado no es válido (dígito verificador incorrecto)',
      })
  ),
  cedula: z.preprocess(
    onlyDigits,
    z
      .string()
      .min(7, 'Cédula inválida')
      .max(8)
      .optional()
      .nullable()
      .refine((val) => !val || validateCedula(val), {
        message: 'La Cédula ingresada no es válida (dígito verificador incorrecto)',
      })
  ),
  // Dirección de texto libre (no se usa para filtrar) + departamento de una
  // lista fija (sí se usa para filtrar en /distribuidoras) — ambos opcionales
  // porque hay distribuidoras ya cargadas sin este dato.
  address: z.string().max(300).optional().nullable(),
  city: z.enum(URUGUAY_DEPARTMENTS).optional().nullable(),
  planId: z.string().cuid('Invalid plan ID'),
});

// ─── Solicitudes de contacto (potenciales distribuidoras) ────────────────────
export const createContactRequestSchema = z.object({
  name: z.string().max(200).optional().nullable(),
  email: z.string().email('Email inválido'),
  phone: z.string().min(1, 'El teléfono es obligatorio').max(20),
});

export const updateContactRequestStatusSchema = z.object({
  status: z.enum(['NEW', 'CONTACTED', 'DISCARDED']),
});

// ─── Password reset ──────────────────────────────────────────────────────────
export const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email format'),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters'),
});

// ─── Public catalog access ──────────────────────────────────────────────────
export const verifyAccessCodeSchema = z.object({
  code: z.string().min(1, 'Code is required'),
  documento: z.preprocess(onlyDigits, z.string().min(7, 'RUT o Cédula es obligatorio').max(12)),
});

// ─── Push notifications (recordatorio diario de pedido) ─────────────────────
export const pushSubscribeSchema = z.object({
  code: z.string().min(1, 'Code is required'),
  documento: z.preprocess(onlyDigits, z.string().min(7, 'RUT o Cédula es obligatorio').max(12)),
  subscription: z.object({
    endpoint: z.string().url(),
    keys: z.object({
      p256dh: z.string().min(1),
      auth: z.string().min(1),
    }),
  }),
});

export const pushUnsubscribeSchema = z.object({
  code: z.string().min(1, 'Code is required'),
  documento: z.preprocess(onlyDigits, z.string().min(7, 'RUT o Cédula es obligatorio').max(12)),
  endpoint: z.string().url(),
});

// ─── Lista de espera de stock ("avisame cuando llegue") ─────────────────────
export const stockWaitlistSchema = z.object({
  code: z.string().min(1, 'Code is required'),
  documento: z.preprocess(onlyDigits, z.string().min(7, 'RUT o Cédula es obligatorio').max(12)),
  productId: z.string().cuid('Invalid product ID'),
});

// ─── Pedidos recurrentes ("pedime esto todos los martes") ───────────────────
export const createRecurringOrderSchema = z.object({
  code: z.string().min(1, 'Code is required'),
  documento: z.preprocess(onlyDigits, z.string().min(7, 'RUT o Cédula es obligatorio').max(12)),
  dayOfWeek: z.number().int().min(0).max(6),
  items: z
    .array(
      z.object({
        productId: z.string().cuid('Invalid product ID'),
        quantity: z.number().int().positive(),
      })
    )
    .min(1, 'El pedido recurrente necesita al menos un producto'),
});

export const setRecurringOrderActiveSchema = z.object({
  code: z.string().min(1, 'Code is required'),
  documento: z.preprocess(onlyDigits, z.string().min(7, 'RUT o Cédula es obligatorio').max(12)),
  active: z.boolean(),
});

// ─── Settings ─────────────────────────────────────────────────────────────
export const updateSettingsSchema = z.object({
  notificationEmail: z.string().email().optional().nullable(),
  whatsappNumber: z.string().max(20).optional().nullable(),
  sendClientEmail: z.boolean().optional(),
  sendWhatsapp: z.boolean().optional(),
});

// La distribuidora edita su propio RUT/Cédula desde Configuración — igual
// que en Client, opcional y uno u otro (no forzamos ninguno de los dos acá:
// muchas distribuidoras ya existentes no lo tienen cargado).
export const updateDistributorProfileSchema = z.object({
  rut: z.preprocess(
    onlyDigits,
    z
      .string()
      .min(7, 'RUT inválido')
      .max(12)
      .optional()
      .nullable()
      .refine((val) => !val || validateRUT(val), {
        message: 'El RUT ingresado no es válido (dígito verificador incorrecto)',
      })
  ),
  cedula: z.preprocess(
    onlyDigits,
    z
      .string()
      .min(7, 'Cédula inválida')
      .max(8)
      .optional()
      .nullable()
      .refine((val) => !val || validateCedula(val), {
        message: 'La Cédula ingresada no es válida (dígito verificador incorrecto)',
      })
  ),
  address: z.string().max(300).optional().nullable(),
  city: z.enum(URUGUAY_DEPARTMENTS).optional().nullable(),
});

export const changePasswordSchema = z.object({
  // Opcional: solo se exige (y se valida) del lado del servicio cuando la
  // distribuidora ya había elegido antes su propia contraseña
  // (Distributor.passwordChanged) — la primera vez no tiene una "actual"
  // real, es el código de acceso que le mandamos por email.
  currentPassword: z.string().optional(),
  newPassword: z
    .string()
    .min(8, 'New password must be at least 8 characters'),
});

// ─── Platform admin (super admin) — "Mi cuenta" ────────────────────────────
// A diferencia del distribuidor, acá siempre exigimos la contraseña actual:
// las cuentas de super admin se crean por script/seed con una contraseña ya
// definida (no hay un "código de acceso" inicial sin contraseña real).
export const updatePlatformProfileSchema = z.object({
  email: z.string().email('Email inválido'),
});

export const changePlatformPasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Ingresá tu contraseña actual'),
  newPassword: z.string().min(8, 'La nueva contraseña debe tener al menos 8 caracteres'),
});

// ─── Inferred types ────────────────────────────────────────────────────────
export type LoginInput = z.infer<typeof loginSchema>;
export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type UpdateStockInput = z.infer<typeof updateStockSchema>;
export type CreateClientInput = z.infer<typeof createClientSchema>;
export type UpdateClientInput = z.infer<typeof updateClientSchema>;
export type OrderStatusInput = z.infer<typeof orderStatusSchema>;
export type CreatePublicOrderInput = z.infer<typeof createPublicOrderSchema>;
export type VerifyAccessCodeInput = z.infer<typeof verifyAccessCodeSchema>;
export type PushSubscribeInput = z.infer<typeof pushSubscribeSchema>;
export type PushUnsubscribeInput = z.infer<typeof pushUnsubscribeSchema>;
export type StockWaitlistInput = z.infer<typeof stockWaitlistSchema>;
export type CreateRecurringOrderInput = z.infer<typeof createRecurringOrderSchema>;
export type SetRecurringOrderActiveInput = z.infer<typeof setRecurringOrderActiveSchema>;
export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;
export type CreatePlanInput = z.infer<typeof createPlanSchema>;
export type UpdatePlanInput = z.infer<typeof updatePlanSchema>;
export type MarkPaidInput = z.infer<typeof markPaidSchema>;
export type ChangeDistributorPlanInput = z.infer<typeof changeDistributorPlanSchema>;
export type CreateDistributorInput = z.infer<typeof createDistributorSchema>;
export type CreateContactRequestInput = z.infer<typeof createContactRequestSchema>;
export type UpdateContactRequestStatusInput = z.infer<typeof updateContactRequestStatusSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type UpdatePlatformProfileInput = z.infer<typeof updatePlatformProfileSchema>;
export type ChangePlatformPasswordInput = z.infer<typeof changePlatformPasswordSchema>;
