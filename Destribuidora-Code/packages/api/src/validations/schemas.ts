import { z } from 'zod';

// ─── Auth ──────────────────────────────────────────────────────────────────
export const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
});

// ─── Product ──────────────────────────────────────────────────────────────
export const createProductSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  code: z.string().max(50).optional().nullable(),
  description: z.string().max(1000).optional().nullable(),
  price: z.number().positive('Price must be positive'),
  stock: z.number().int().min(0, 'Stock cannot be negative'),
  category: z.string().max(100).optional().nullable(),
  imageUrl: z.string().url().optional().nullable(),
  active: z.boolean().optional().default(true),
});

export const updateProductSchema = createProductSchema.partial();

export const updateStockSchema = z.object({
  stock: z.number().int().min(0, 'Stock cannot be negative'),
});

// ─── Client ───────────────────────────────────────────────────────────────
export const createClientSchema = z.object({
  rut: z.string().min(8, 'RUT must be at least 8 characters').max(12),
  name: z.string().max(200).optional().nullable(),
  email: z.string().email().optional().nullable(),
  phone: z.string().max(20).optional().nullable(),
});

export const updateClientSchema = createClientSchema.partial().omit({ rut: true });

// ─── Order ────────────────────────────────────────────────────────────────
export const orderStatusSchema = z.object({
  status: z.enum(['PENDING', 'PROCESSING', 'COMPLETED', 'CANCELLED']),
});

// ─── Public order creation ─────────────────────────────────────────────────
export const createPublicOrderSchema = z.object({
  rut: z.string().min(8, 'RUT is required').max(12),
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

// ─── Settings ─────────────────────────────────────────────────────────────
export const updateSettingsSchema = z.object({
  notificationEmail: z.string().email().optional().nullable(),
  whatsappNumber: z.string().max(20).optional().nullable(),
  sendClientEmail: z.boolean().optional(),
  sendWhatsapp: z.boolean().optional(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z
    .string()
    .min(8, 'New password must be at least 8 characters'),
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
export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
