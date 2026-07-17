require('dotenv/config');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const result = await prisma.$executeRawUnsafe(`
    UPDATE "Product"
    SET code = code || '-DEL-' || substr(id, -6)
    WHERE active = false AND code IS NOT NULL AND code NOT LIKE '%-DEL-%'
  `);
  console.log('Productos corregidos:', result);
}

main()
  .catch((err) => {
    console.error('Error:', err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
