-- Dirección y ciudad (departamento) de la distribuidora, para que el
-- superadmin las cargue al dar de alta y el cliente pueda filtrar por
-- zona en /distribuidoras.
ALTER TABLE "Distributor" ADD COLUMN "address" TEXT;
ALTER TABLE "Distributor" ADD COLUMN "city" TEXT;
