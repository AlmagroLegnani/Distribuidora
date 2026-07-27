-- Marca si la distribuidora ya eligió su propia contraseña (en vez de seguir
-- usando el código de acceso original como contraseña).
ALTER TABLE "Distributor" ADD COLUMN "passwordChanged" BOOLEAN NOT NULL DEFAULT false;
