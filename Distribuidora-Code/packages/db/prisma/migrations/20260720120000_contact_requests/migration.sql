-- Solicitudes de contacto de potenciales distribuidoras (botón "Contactate
-- con nosotros" en la home pública) — se gestionan desde el panel de
-- superadmin, sección "Solicitudes".

CREATE TYPE "ContactRequestStatus" AS ENUM ('NEW', 'CONTACTED', 'DISCARDED');

CREATE TABLE "ContactRequest" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "status" "ContactRequestStatus" NOT NULL DEFAULT 'NEW',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContactRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ContactRequest_status_createdAt_idx" ON "ContactRequest"("status", "createdAt");
