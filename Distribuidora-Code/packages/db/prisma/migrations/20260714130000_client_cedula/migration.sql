-- Clients can now be identified by RUT or by Cédula de Identidad (for small
-- clients/almacenes that don't have a RUT). At least one of the two must be
-- present, enforced with a CHECK constraint since a distributor's client list
-- must always have a usable identifier.

-- Make "rut" optional
ALTER TABLE "Client" ALTER COLUMN "rut" DROP NOT NULL;

-- New optional "cedula" column
ALTER TABLE "Client" ADD COLUMN "cedula" TEXT;

-- Unique per distributor for cedula too (nulls don't conflict with each other in Postgres)
CREATE UNIQUE INDEX "Client_distributorId_cedula_key" ON "Client"("distributorId", "cedula");

-- Require at least one identifier
ALTER TABLE "Client" ADD CONSTRAINT "Client_rut_or_cedula_check" CHECK ("rut" IS NOT NULL OR "cedula" IS NOT NULL);
