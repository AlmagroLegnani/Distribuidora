import { ImapFlow } from 'imapflow';
import { prisma } from '../lib/prisma';

const CLEANUP_DELAY_MS = 60 * 60 * 1000; // 1 hora
const BATCH_SIZE = 50;

/**
 * Borra de la bandeja "Enviados" de la cuenta de Gmail usada para mandar
 * correos (SMTP_USER/SMTP_PASS) los mensajes que ya pasaron 1 hora desde que
 * se enviaron. Esto es parte del compromiso de confidencialidad: TuStockApp
 * actúa como intermediario técnico y no conserva un historial de la
 * correspondencia entre distribuidoras y clientes.
 *
 * Es best-effort: si algo falla (sin credenciales, IMAP caído, mensaje ya
 * borrado a mano, etc.) se loguea el error y se sigue con el resto — nunca
 * debe tirar abajo el proceso principal de la API.
 */
export async function cleanupOldSentEmails(): Promise<void> {
  const { SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_USER || !SMTP_PASS) return; // SMTP no configurado — nada que limpiar

  const cutoff = new Date(Date.now() - CLEANUP_DELAY_MS);
  const pending = await prisma.sentEmail.findMany({
    where: { deletedAt: null, sentAt: { lte: cutoff } },
    take: BATCH_SIZE,
    orderBy: { sentAt: 'asc' },
  });

  if (pending.length === 0) return;

  const client = new ImapFlow({
    host: process.env.IMAP_HOST || 'imap.gmail.com',
    port: parseInt(process.env.IMAP_PORT || '993', 10),
    secure: true,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
    logger: false,
  });

  try {
    await client.connect();
  } catch (err) {
    console.error(`[${new Date().toISOString()}] [email-cleanup] No se pudo conectar por IMAP:`, err);
    return;
  }

  try {
    // Gmail expone la carpeta de enviados con el atributo especial \Sent —
    // dejamos que ImapFlow la busque en vez de hardcodear el nombre exacto
    // (que puede variar según el idioma de la cuenta).
    const mailboxes = await client.list();
    const sentMailbox =
      mailboxes.find((m) => m.specialUse === '\\Sent')?.path || '[Gmail]/Sent Mail';

    const lock = await client.getMailboxLock(sentMailbox);
    try {
      for (const email of pending) {
        try {
          const uids = await client.search({ header: { 'message-id': email.messageId } }, { uid: true });
          if (uids && uids.length > 0) {
            await client.messageDelete(uids, { uid: true });
          }
          await prisma.sentEmail.update({
            where: { id: email.id },
            data: { deletedAt: new Date() },
          });
        } catch (err) {
          console.error(
            `[${new Date().toISOString()}] [email-cleanup] Falló al borrar mail ${email.messageId}:`,
            err
          );
        }
      }
    } finally {
      lock.release();
    }
  } catch (err) {
    console.error(`[${new Date().toISOString()}] [email-cleanup] Error general:`, err);
  } finally {
    await client.logout().catch(() => {});
  }
}
