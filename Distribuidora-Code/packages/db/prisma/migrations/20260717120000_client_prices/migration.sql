-- Precio especial por cliente y producto (ej: un cliente que compra mucho de
-- un producto recibe un descuento). Si no hay fila para (clientId, productId),
-- ese cliente paga el precio de lista normal (Product.price).

CREATE TABLE "ClientPrice" (
    "id" TEXT NOT NULL,
    "distributorId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientPrice_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ClientPrice_clientId_productId_key" ON "ClientPrice"("clientId", "productId");

CREATE INDEX "ClientPrice_distributorId_productId_idx" ON "ClientPrice"("distributorId", "productId");

ALTER TABLE "ClientPrice" ADD CONSTRAINT "ClientPrice_distributorId_fkey" FOREIGN KEY ("distributorId") REFERENCES "Distributor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ClientPrice" ADD CONSTRAINT "ClientPrice_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ClientPrice" ADD CONSTRAINT "ClientPrice_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
