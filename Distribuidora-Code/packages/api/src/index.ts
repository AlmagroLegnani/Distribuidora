import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { errorHandler } from './middleware/errorHandler';
import routes from './routes';
import { cleanupOldSentEmails } from './services/emailCleanupService';

const app = express();
const PORT = parseInt(process.env.PORT || '3001', 10);

// Security headers
app.use(helmet());

// CORS
const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000,http://localhost:3002').split(',');
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, Postman, etc.)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      callback(new Error(`CORS: origin ${origin} not allowed`));
    },
    credentials: true,
    exposedHeaders: ['X-Total-Count', 'X-Client-Email'],
  })
);

// Body parsing
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API routes
app.use('/api', routes);

// Global error handler (must be last)
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`[${new Date().toISOString()}] Server running on port ${PORT} (${process.env.NODE_ENV || 'development'})`);
});

// Job de limpieza de mails enviados (borra de "Enviados" en Gmail los que ya
// pasaron 1 hora) — no hay un scheduler real en este stack, así que se corre
// con un setInterval simple, cada 10 minutos, sin bloquear el arranque.
const EMAIL_CLEANUP_INTERVAL_MS = 10 * 60 * 1000;
setInterval(() => {
  cleanupOldSentEmails().catch((err) =>
    console.error(`[${new Date().toISOString()}] [email-cleanup] Error inesperado:`, err)
  );
}, EMAIL_CLEANUP_INTERVAL_MS);

export default app;
