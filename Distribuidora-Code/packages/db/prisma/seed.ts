import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main(): Promise<void> {

  // Create platform admin (owner of the SaaS)
  const platformAdminPassword = await bcrypt.hash('platform1234', 10);
  await prisma.platformAdmin.upsert({
    where: { email: 'admin@stockapp.com' },
    update: {},
    create: {
      email: 'admin@stockapp.com',
      password: platformAdminPassword,
      name: 'Platform Admin',
    },
  });

  // Plan único: no hay distintos niveles/tiers, todas las distribuidoras pagan
  // lo mismo por mes (con 3 meses de prueba gratuita al principio).
  const basicPlan = await prisma.plan.upsert({
    where: { slug: 'unico' },
    update: {},
    create: {
      name: 'Plan TuStockApp',
      slug: 'unico',
      price: 19990,
      currency: 'UYU',
      maxProducts: null,
      maxClients: null,
      maxOrdersMonth: null,
    },
  });

  // Limpieza: de cuando existían varios planes/niveles (Básico, Pro, "Plan
  // mensual", etc.) pueden haber quedado distribuidoras reales con su
  // Subscription apuntando a esos planes viejos, aunque ya no aparezcan en
  // pantalla. Como ahora es un solo plan para todos, movemos TODAS las
  // suscripciones al plan único y borramos cualquier otro plan que haya
  // quedado dando vueltas (ya sin nada enganchado, así que el delete no falla).
  await prisma.subscription.updateMany({
    where: { planId: { not: basicPlan.id } },
    data: { planId: basicPlan.id },
  });
  await prisma.plan.deleteMany({ where: { id: { not: basicPlan.id } } });

  // Create demo distributor
  const hashedPassword = await bcrypt.hash('demo1234', 10);

  const distributor = await prisma.distributor.upsert({
    where: { email: 'demo@stockapp.com' },
    update: {},
    create: {
      name: 'Distribuidora Norte',
      email: 'demo@stockapp.com',
      password: hashedPassword,
      phone: '+598 2900 1234',
      slug: 'demo',
      settings: {
        create: {
          notificationEmail: 'demo@stockapp.com',
          sendClientEmail: true,
          sendWhatsapp: false,
        },
      },
    },
  });

  // Demo distributor has an active subscription (paid, far from expiring)
  const oneMonthFromNow = new Date();
  oneMonthFromNow.setMonth(oneMonthFromNow.getMonth() + 1);

  await prisma.subscription.upsert({
    where: { distributorId: distributor.id },
    update: {},
    create: {
      distributorId: distributor.id,
      planId: basicPlan.id,
      status: 'ACTIVE',
      currentPeriodEnd: oneMonthFromNow,
    },
  });



  // Create 10 sample products
  const productsData = [
    { name: 'Harina Blanca 1kg', code: 'PROD-001', price: 1200, stock: 150, category: 'Abarrotes', description: 'Harina blanca de trigo extra fina' },
    { name: 'Aceite Vegetal 1L', code: 'PROD-002', price: 2800, stock: 80, category: 'Abarrotes', description: 'Aceite vegetal refinado' },
    { name: 'Arroz Grano Largo 1kg', code: 'PROD-003', price: 1500, stock: 200, category: 'Abarrotes', description: 'Arroz grano largo premium' },
    { name: 'Azúcar Blanca 1kg', code: 'PROD-004', price: 1100, stock: 120, category: 'Abarrotes', description: 'Azúcar blanca refinada' },
    { name: 'Fideos Spaghetti 400g', code: 'PROD-005', price: 850, stock: 300, category: 'Abarrotes', description: 'Fideos tipo spaghetti' },
    { name: 'Leche Entera 1L', code: 'PROD-006', price: 950, stock: 60, category: 'Lácteos', description: 'Leche entera pasteurizada' },
    { name: 'Mantequilla 200g', code: 'PROD-007', price: 1800, stock: 40, category: 'Lácteos', description: 'Mantequilla sin sal' },
    { name: 'Detergente Líquido 500ml', code: 'PROD-008', price: 1600, stock: 75, category: 'Limpieza', description: 'Detergente líquido para ropa' },
    { name: 'Papel Higiénico x4', code: 'PROD-009', price: 2200, stock: 0, category: 'Limpieza', description: 'Papel higiénico doble hoja pack x4' },
    { name: 'Café Molido 250g', code: 'PROD-010', price: 3500, stock: 50, category: 'Bebidas', description: 'Café molido premium' },
  ];

  for (const prod of productsData) {
    await prisma.product.upsert({
      where: { distributorId_code: { distributorId: distributor.id, code: prod.code } },
      update: {},
      create: { distributorId: distributor.id, ...prod },
    });
  }

 

  // Create 4 sample clients (three with RUT, one with only Cédula — small
  // almacenes often don't have one). The first two and the last already have
  // an access code, as if it had been generated and emailed from the admin panel.
  const clientsData: Array<{
    rut: string | null;
    cedula: string | null;
    name: string;
    email: string | null;
    phone: string;
    accessCode: string | null;
    accessCodeSentAt: Date | null;
  }> = [
    {
      rut: '211234560019',
      cedula: null,
      name: 'Supermercado El Sol',
      email: 'compras@elsol.com.uy',
      phone: '+598 99 223 344',
      accessCode: 'SOL2026A',
      accessCodeSentAt: new Date(),
    },
    {
      rut: '211234560027',
      cedula: null,
      name: 'Minimarket Don Pepe',
      email: 'donpepe@email.com',
      phone: '+598 99 334 455',
      accessCode: 'PEPE2026',
      accessCodeSentAt: new Date(),
    },
    {
      rut: '211234560035',
      cedula: null,
      name: 'Almacén La Esquina',
      email: null,
      phone: '+598 99 112 233',
      accessCode: null,
      accessCodeSentAt: null,
    },
    {
      rut: null,
      cedula: '12345672',
      name: 'Almacén Doña Rosa',
      email: 'donarosa@email.com',
      phone: '+598 99 556 677',
      accessCode: 'ROSA2026',
      accessCodeSentAt: new Date(),
    },
  ];

  const clients = [];
  for (const c of clientsData) {
    const existing = await prisma.client.findFirst({
      where: {
        distributorId: distributor.id,
        OR: [
          ...(c.rut ? [{ rut: c.rut }] : []),
          ...(c.cedula ? [{ cedula: c.cedula }] : []),
        ],
      },
    });
    const client = existing
      ? await prisma.client.update({ where: { id: existing.id }, data: c })
      : await prisma.client.create({ data: { distributorId: distributor.id, ...c } });
    clients.push(client);
  }

 

  // Get all products for orders
  const products = await prisma.product.findMany({
    where: { distributorId: distributor.id, stock: { gt: 0 } },
  });

  if (products.length < 3) {
    return;
  }

  // Create 5 sample orders
  const ordersData = [
    {
      clientIdx: 0,
      status: 'COMPLETED' as const,
      notes: 'Entrega en sucursal central',
      items: [
        { product: products[0], quantity: 10 },
        { product: products[1], quantity: 5 },
      ],
    },
    {
      clientIdx: 1,
      status: 'PROCESSING' as const,
      notes: null,
      items: [
        { product: products[2], quantity: 20 },
        { product: products[3], quantity: 15 },
      ],
    },
    {
      clientIdx: 2,
      status: 'PENDING' as const,
      notes: 'Llamar antes de enviar',
      items: [{ product: products[4], quantity: 30 }],
    },
    {
      clientIdx: 0,
      status: 'PENDING' as const,
      notes: null,
      items: [
        { product: products[0], quantity: 5 },
        { product: products[5], quantity: 8 },
      ],
    },
    {
      clientIdx: 1,
      status: 'CANCELLED' as const,
      notes: 'Cancelado por cliente',
      items: [{ product: products[1], quantity: 3 }],
    },
    {
      // Doña Rosa — the client identified by Cédula instead of RUT.
      clientIdx: 3,
      status: 'PENDING' as const,
      notes: null,
      items: [{ product: products[2], quantity: 4 }],
    },
  ];

  for (const orderData of ordersData) {
    const orderItems = orderData.items.map(({ product, quantity }) => ({
      productId: product.id,
      quantity,
      unitPrice: product.price,
      subtotal: product.price * quantity,
    }));

    const total = orderItems.reduce((sum, i) => sum + i.subtotal, 0);

    await prisma.order.create({
      data: {
        distributorId: distributor.id,
        clientId: clients[orderData.clientIdx].id,
        total,
        status: orderData.status,
        notes: orderData.notes,
        items: { create: orderItems },
      },
    });
  }


}

main()
  .then(() => {
    console.log('Seed completado correctamente.');
  })
  .catch((e) => {
    console.error('Error al correr el seed:', e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
