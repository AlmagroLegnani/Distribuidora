import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { errorHandler } from './middleware/errorHandler';
import routes from './routes';
import { cleanupOldSentEmails } from './services/emailCleanupService';
import { sendDailyOrderReminders, sendAfternoonOrderReminders } from './services/reminderService';
import { detectReorderSuggestions } from './services/reorderSuggestionService';
import { detectCoolingClients } from './services/clientCoolingService';
import { generateDueRecurringOrders } from './services/recurringOrderService';
import { sendMonthlySummaries } from './services/monthlySummaryService';

const app = express();
const PORT = parseInt(process.env.PORT || '3001', 10);

// Railway (como cualquier PaaS) pone la app detrás de su propio proxy/load
// balancer, que agrega el header X-Forwarded-For con la IP real del cliente.
// Sin esto, Express no confía en ese header y express-rate-limit tira
// ERR_ERL_UNEXPECTED_X_FORWARDED_FOR en cada request a una ruta con límite
// de intentos (login, etc.) — "1" le dice que confíe en un solo hop de proxy
// por delante, que es exactamente el caso acá.
app.set('trust proxy', 1);

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

// Recordatorio diario de "hacé tu pedido" a los clientes que activaron
// notificaciones. No hay un scheduler real en este stack (igual que la
// limpieza de emails de arriba), así que revisamos cada 5 minutos si ya es
// la hora (9am Uruguay = 12:00 UTC, todo el año, sin horario de verano) y si
// todavía no lo mandamos hoy — el flag en memoria evita mandarlo dos veces
// si el chequeo cae más de una vez dentro de la misma ventana de la hora.
const REMINDER_CHECK_INTERVAL_MS = 5 * 60 * 1000;
const REMINDER_HOUR_UTC = 12; // 9:00 Uruguay
let lastReminderRunDate: string | null = null;
setInterval(() => {
  const now = new Date();
  const todayKey = now.toISOString().slice(0, 10); // "YYYY-MM-DD"
  if (now.getUTCHours() !== REMINDER_HOUR_UTC) return;
  if (lastReminderRunDate === todayKey) return;

  lastReminderRunDate = todayKey;
  sendDailyOrderReminders().catch((err) =>
    console.error(`[${new Date().toISOString()}] [reminder] Error inesperado:`, err)
  );
}, REMINDER_CHECK_INTERVAL_MS);

// Segunda pasada del recordatorio, por si el cliente ignoró (o nunca vio) el
// de las 9am: corre a las 15:30 Uruguay = 18:30 UTC y solo le llega a quien
// TODAVÍA no hizo ningún pedido hoy. Mismo patrón de flag-en-memoria.
const AFTERNOON_REMINDER_HOUR_UTC = 18;
const AFTERNOON_REMINDER_MINUTE_UTC = 30;
let lastAfternoonReminderRunDate: string | null = null;
setInterval(() => {
  const now = new Date();
  const todayKey = now.toISOString().slice(0, 10);
  if (now.getUTCHours() !== AFTERNOON_REMINDER_HOUR_UTC) return;
  if (now.getUTCMinutes() < AFTERNOON_REMINDER_MINUTE_UTC) return;
  if (lastAfternoonReminderRunDate === todayKey) return;

  lastAfternoonReminderRunDate = todayKey;
  sendAfternoonOrderReminders().catch((err) =>
    console.error(`[${new Date().toISOString()}] [reminder] Error inesperado:`, err)
  );
}, REMINDER_CHECK_INTERVAL_MS);

// Detección de "pedidos recurrentes" (mismo producto pedido la semana
// calendario pasada y todavía no repetido esta semana): corre una vez al
// día, un rato antes del recordatorio de arriba (8am Uruguay = 11:00 UTC),
// para que las sugerencias ya estén generadas en Notificaciones cuando la
// distribuidora arranca su día. Mismo patrón de flag-en-memoria que los jobs
// de arriba.
const REORDER_SUGGESTION_HOUR_UTC = 11; // 8:00 Uruguay
let lastReorderSuggestionRunDate: string | null = null;
setInterval(() => {
  const now = new Date();
  const todayKey = now.toISOString().slice(0, 10);
  if (now.getUTCHours() !== REORDER_SUGGESTION_HOUR_UTC) return;
  if (lastReorderSuggestionRunDate === todayKey) return;

  lastReorderSuggestionRunDate = todayKey;
  detectReorderSuggestions().catch((err) =>
    console.error(`[${new Date().toISOString()}] [reorder-suggestion] Error inesperado:`, err)
  );
}, REMINDER_CHECK_INTERVAL_MS);

// Detección de "clientes que se enfriaron" (venían pidiendo seguido y hace
// 14+ días que no hacen nada): corre una vez al día, misma hora que las
// sugerencias de recompra de arriba (8am Uruguay = 11:00 UTC) — el aviso le
// llega a la DISTRIBUIDORA, no al cliente, para que lo llame.
let lastClientCoolingRunDate: string | null = null;
setInterval(() => {
  const now = new Date();
  const todayKey = now.toISOString().slice(0, 10);
  if (now.getUTCHours() !== REORDER_SUGGESTION_HOUR_UTC) return;
  if (lastClientCoolingRunDate === todayKey) return;

  lastClientCoolingRunDate = todayKey;
  detectCoolingClients().catch((err) =>
    console.error(`[${new Date().toISOString()}] [client-cooling] Error inesperado:`, err)
  );
}, REMINDER_CHECK_INTERVAL_MS);

// Generación automática de pedidos recurrentes ("pedime esto todos los
// martes"): corre temprano, 6am Uruguay = 9:00 UTC, antes que el resto de
// los jobs del día, para que el pedido ya esté generado cuando la
// distribuidora y el cliente arrancan su día.
const RECURRING_ORDERS_HOUR_UTC = 9; // 6:00 Uruguay
let lastRecurringOrdersRunDate: string | null = null;
setInterval(() => {
  const now = new Date();
  const todayKey = now.toISOString().slice(0, 10);
  if (now.getUTCHours() !== RECURRING_ORDERS_HOUR_UTC) return;
  if (lastRecurringOrdersRunDate === todayKey) return;

  lastRecurringOrdersRunDate = todayKey;
  generateDueRecurringOrders().catch((err) =>
    console.error(`[${new Date().toISOString()}] [recurring-orders] Error inesperado:`, err)
  );
}, REMINDER_CHECK_INTERVAL_MS);

// Resumen mensual ("esto pediste este mes, esto gastaste"): corre el día 1
// de cada mes, 10am Uruguay = 13:00 UTC. Usa una clave "YYYY-MM" en vez de
// la fecha completa para no reintentar el resto del mes una vez enviado.
const MONTHLY_SUMMARY_HOUR_UTC = 13; // 10:00 Uruguay
let lastMonthlySummaryRunMonth: string | null = null;
setInterval(() => {
  const now = new Date();
  const monthKey = now.toISOString().slice(0, 7); // "YYYY-MM"
  if (now.getUTCDate() !== 1) return;
  if (now.getUTCHours() !== MONTHLY_SUMMARY_HOUR_UTC) return;
  if (lastMonthlySummaryRunMonth === monthKey) return;

  lastMonthlySummaryRunMonth = monthKey;
  sendMonthlySummaries().catch((err) =>
    console.error(`[${new Date().toISOString()}] [monthly-summary] Error inesperado:`, err)
  );
}, REMINDER_CHECK_INTERVAL_MS);

export default app;
