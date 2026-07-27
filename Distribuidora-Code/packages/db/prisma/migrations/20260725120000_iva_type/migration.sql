-- Tasa de IVA de Uruguay (Básica 22% / Mínima 10%) que ya está incluida en el
-- precio del producto (precio final al público, no se recalcula nada). Se
-- guarda también una copia en OrderItem al momento de la compra, igual que
-- unitPrice/subtotal, para que un cambio posterior de tasa no altere pedidos
-- ni comprobantes ya generados.

CREATE TYPE "IvaType" AS ENUM ('BASICA', 'MINIMA');

ALTER TABLE "Product" ADD COLUMN "ivaType" "IvaType" NOT NULL DEFAULT 'BASICA';

ALTER TABLE "OrderItem" ADD COLUMN "ivaType" "IvaType" NOT NULL DEFAULT 'BASICA';
