-- Generaliza StockAlert para poder usarlo también como aviso de vencimiento de pago,
-- no sólo de stock bajo.

ALTER TABLE "StockAlert" ADD COLUMN "type" TEXT NOT NULL DEFAULT 'LOW_STOCK';
ALTER TABLE "StockAlert" ADD COLUMN "message" TEXT;

ALTER TABLE "StockAlert" ALTER COLUMN "productId" DROP NOT NULL;
ALTER TABLE "StockAlert" ALTER COLUMN "productName" DROP NOT NULL;
ALTER TABLE "StockAlert" ALTER COLUMN "stockAtAlert" DROP NOT NULL;
ALTER TABLE "StockAlert" ALTER COLUMN "threshold" DROP NOT NULL;
