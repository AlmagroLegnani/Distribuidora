-- AlterTable
ALTER TABLE "StockAlert" ADD COLUMN     "clientId" TEXT,
ADD COLUMN     "clientName" TEXT,
ADD COLUMN     "reminderSentAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "StockAlert_clientId_productId_createdAt_idx" ON "StockAlert"("clientId", "productId", "createdAt");

-- AddForeignKey
ALTER TABLE "StockAlert" ADD CONSTRAINT "StockAlert_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;
