-- CreateTable
CREATE TABLE "StockWaitlist" (
    "id" TEXT NOT NULL,
    "distributorId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockWaitlist_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StockWaitlist_distributorId_productId_idx" ON "StockWaitlist"("distributorId", "productId");

-- CreateIndex
CREATE UNIQUE INDEX "StockWaitlist_clientId_productId_key" ON "StockWaitlist"("clientId", "productId");

-- AddForeignKey
ALTER TABLE "StockWaitlist" ADD CONSTRAINT "StockWaitlist_distributorId_fkey" FOREIGN KEY ("distributorId") REFERENCES "Distributor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockWaitlist" ADD CONSTRAINT "StockWaitlist_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockWaitlist" ADD CONSTRAINT "StockWaitlist_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
