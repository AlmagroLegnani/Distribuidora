import { v2 as cloudinary } from 'cloudinary';

// Fotos de producto: se suben a Cloudinary (plan gratuito) en vez de guardarse
// en el disco del servidor — la mayoría de los hostings (Railway, Vercel, etc.)
// tienen disco efímero, así que cualquier archivo guardado localmente se
// perdería en el próximo redeploy. Cloudinary también nos da compresión y
// redimensionado automático sin tener que programarlo nosotros.
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

export function isCloudinaryConfigured(): boolean {
  return Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET
  );
}

/** Sube un buffer de imagen (memoria, ver multer memoryStorage) y devuelve la URL pública. */
export function uploadProductImage(buffer: Buffer): Promise<string> {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: 'stockapp/products',
        // Redimensiona a un máximo razonable para catálogo (no hace falta
        // subir/guardar fotos de cámara a resolución completa) y comprime
        // automáticamente sin perder calidad visible.
        transformation: [{ width: 1000, height: 1000, crop: 'limit', quality: 'auto' }],
      },
      (err, result) => {
        if (err || !result) return reject(err || new Error('Cloudinary upload failed'));
        resolve(result.secure_url);
      }
    );
    stream.end(buffer);
  });
}

export default cloudinary;
