-- Aviso de stock bajo: campo de control en Product + tabla StockAlert

ALTER TABLE "Product" ADD COLUMN "lowStockAlerted" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "StockAlert" (
    "id" TEXT NOT NULL,
    "distributorId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "stockAtAlert" INTEGER NOT NULL,
    "threshold" INTEGER NOT NULL,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "emailSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockAlert_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "StockAlert_distributorId_read_idx" ON "StockAlert"("distributorId", "read");

ALTER TABLE "StockAlert" ADD CONSTRAINT "StockAlert_distributorId_fkey" FOREIGN KEY ("distributorId") REFERENCES "Distributor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "StockAlert" ADD CONSTRAINT "StockAlert_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
