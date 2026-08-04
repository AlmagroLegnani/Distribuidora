-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "promotionActive" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "promotionEndDate" DATE,
ADD COLUMN     "promotionText" TEXT;
