-- Registro de mails enviados (Message-ID + fecha) para el job de limpieza
-- que borra la copia de "Enviados" en Gmail pasada una hora.

CREATE TABLE "SentEmail" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SentEmail_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SentEmail_messageId_key" ON "SentEmail"("messageId");

CREATE INDEX "SentEmail_deletedAt_sentAt_idx" ON "SentEmail"("deletedAt", "sentAt");
