-- DropForeignKey
ALTER TABLE "StockAlert" DROP CONSTRAINT "StockAlert_productId_fkey";

-- AddForeignKey
ALTER TABLE "StockAlert" ADD CONSTRAINT "StockAlert_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
