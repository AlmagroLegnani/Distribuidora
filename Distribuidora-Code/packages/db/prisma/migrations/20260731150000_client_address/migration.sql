-- Dirección del comercio/almacén del cliente, para reparto. Opcional (hay
-- clientes ya cargados sin este dato, y no todos lo necesitan si el cliente
-- retira o ya se conoce la dirección por otro medio).
ALTER TABLE "Client" ADD COLUMN "address" TEXT;
