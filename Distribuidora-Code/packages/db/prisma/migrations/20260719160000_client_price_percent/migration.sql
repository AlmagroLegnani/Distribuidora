-- Cambia ClientPrice de precio fijo a porcentaje de descuento. Se vacían los
-- registros existentes (son datos de prueba, no hay forma de convertir un
-- precio absoluto a porcentaje sin saber el precio de lista al momento de la
-- carga original).

DELETE FROM "ClientPrice";
ALTER TABLE "ClientPrice" DROP COLUMN "price";
ALTER TABLE "ClientPrice" ADD COLUMN "discountPercent" DOUBLE PRECISION NOT NULL;
