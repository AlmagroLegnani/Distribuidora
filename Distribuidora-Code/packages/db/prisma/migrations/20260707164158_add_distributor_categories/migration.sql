-- AlterTable
ALTER TABLE "Distributor" ADD COLUMN     "categories" TEXT[] DEFAULT ARRAY[]::TEXT[];
