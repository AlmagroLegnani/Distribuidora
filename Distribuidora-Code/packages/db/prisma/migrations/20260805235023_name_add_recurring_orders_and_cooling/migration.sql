-- CreateTable
CREATE TABLE "RecurringOrder" (
    "id" TEXT NOT NULL,
    "distributorId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lastGeneratedAt" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecurringOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecurringOrderItem" (
    "id" TEXT NOT NULL,
    "recurringOrderId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,

    CONSTRAINT "RecurringOrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RecurringOrder_distributorId_dayOfWeek_active_idx" ON "RecurringOrder"("distributorId", "dayOfWeek", "active");

-- CreateIndex
CREATE INDEX "RecurringOrderItem_recurringOrderId_idx" ON "RecurringOrderItem"("recurringOrderId");

-- AddForeignKey
ALTER TABLE "RecurringOrder" ADD CONSTRAINT "RecurringOrder_distributorId_fkey" FOREIGN KEY ("distributorId") REFERENCES "Distributor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringOrder" ADD CONSTRAINT "RecurringOrder_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringOrderItem" ADD CONSTRAINT "RecurringOrderItem_recurringOrderId_fkey" FOREIGN KEY ("recurringOrderId") REFERENCES "RecurringOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringOrderItem" ADD CONSTRAINT "RecurringOrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
