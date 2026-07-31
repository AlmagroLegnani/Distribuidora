import { Router } from 'express';
import multer from 'multer';
import * as productController from '../controllers/productController';
import { authMiddleware } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { createProductSchema, updateProductSchema, updateStockSchema } from '../validations/schemas';

const router = Router();

// Memoria, no disco: el buffer se sube directo a Cloudinary y se descarta
// (ver lib/cloudinary.ts) — nunca queda un archivo temporal en el servidor.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      cb(new Error('El archivo debe ser una imagen'));
      return;
    }
    cb(null, true);
  },
});

// All product routes require authentication
router.use(authMiddleware);

// GET /api/products
router.get('/', productController.list);

// POST /api/products/upload-image  — sube la foto a Cloudinary, devuelve { url }
router.post('/upload-image', upload.single('image'), productController.uploadImage);

// GET /api/products/categories
router.get('/categories', productController.categories);

// GET /api/products/brands
router.get('/brands', productController.brands);

// GET /api/products/:id
router.get('/:id', productController.getById);

// POST /api/products
router.post('/', validate(createProductSchema), productController.create);

// PUT /api/products/:id
router.put('/:id', validate(updateProductSchema), productController.update);

// DELETE /api/products/:id
router.delete('/:id', productController.remove);

// PATCH /api/products/:id/stock
router.patch('/:id/stock', validate(updateStockSchema), productController.updateStock);

export default router;
