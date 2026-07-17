-- DropForeignKey
ALTER TABLE "ClientPrice" DROP CONSTRAINT "ClientPrice_clientId_fkey";

-- DropForeignKey
ALTER TABLE "ClientPrice" DROP CONSTRAINT "ClientPrice_productId_fkey";

-- AddForeignKey
ALTER TABLE "ClientPrice" ADD CONSTRAINT "ClientPrice_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientPrice" ADD CONSTRAINT "ClientPrice_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
