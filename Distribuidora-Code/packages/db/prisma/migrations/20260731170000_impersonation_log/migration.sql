-- Auditoría de "Entrar como esta distribuidora" desde el panel de super admin.
CREATE TABLE "ImpersonationLog" (
    "id" TEXT NOT NULL,
    "platformAdminId" TEXT NOT NULL,
    "distributorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImpersonationLog_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "ImpersonationLog" ADD CONSTRAINT "ImpersonationLog_platformAdminId_fkey" FOREIGN KEY ("platformAdminId") REFERENCES "PlatformAdmin"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ImpersonationLog" ADD CONSTRAINT "ImpersonationLog_distributorId_fkey" FOREIGN KEY ("distributorId") REFERENCES "Distributor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
