-- Agrega RUT/Cédula a la distribuidora (opcional, uno u otro, igual que en Client)
ALTER TABLE "Distributor" ADD COLUMN "rut" TEXT;
ALTER TABLE "Distributor" ADD COLUMN "cedula" TEXT;

CREATE UNIQUE INDEX "Distributor_rut_key" ON "Distributor"("rut");
CREATE UNIQUE INDEX "Distributor_cedula_key" ON "Distributor"("cedula");
