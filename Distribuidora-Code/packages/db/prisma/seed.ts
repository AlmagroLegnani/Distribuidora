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

  // Create commercial plans
  const basicPlan = await prisma.plan.upsert({
    where: { slug: 'basico' },
    update: {},
    create: {
      name: 'Básico',
      slug: 'basico',
      price: 19990,
      currency: 'CLP',
      maxProducts: 100,
      maxClients: 200,
      maxOrdersMonth: 300,
    },
  });

  await prisma.plan.upsert({
    where: { slug: 'pro' },
    update: {},
    create: {
      name: 'Pro',
      slug: 'pro',
      price: 39990,
      currency: 'CLP',
      maxProducts: null,
      maxClients: null,
      maxOrdersMonth: null,
    },
  });

  // Create demo distributor
  const hashedPassword = await bcrypt.hash('demo1234', 10);

  const distributor = await prisma.distributor.upsert({
    where: { email: 'demo@stockapp.com' },
    update: { categories: ['Alimentos No Perecederos', 'Lácteos y Fríos', 'Limpieza e Higiene'] },
    create: {
      name: 'Distribuidora Norte',
      email: 'demo@stockapp.com',
      password: hashedPassword,
      phone: '+56912345678',
      slug: 'demo',
      categories: ['Alimentos No Perecederos', 'Lácteos y Fríos', 'Limpieza e Higiene'],
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

 

  // Create 3 sample clients (the first two already have an access code, as if it
  // had been generated and emailed to them from the admin panel)
  const clientsData = [
    {
      rut: '76543210-1',
      name: 'Supermercado El Sol',
      email: 'compras@elsol.cl',
      phone: '+56922334455',
      accessCode: 'SOL2026A',
      accessCodeSentAt: new Date(),
    },
    {
      rut: '12345678-9',
      name: 'Minimarket Don Pepe',
      email: 'donpepe@email.cl',
      phone: '+56933445566',
      accessCode: 'PEPE2026',
      accessCodeSentAt: new Date(),
    },
    {
      rut: '98765432-1',
      name: 'Almacén La Esquina',
      email: null,
      phone: '+56911223344',
      accessCode: null,
      accessCodeSentAt: null,
    },
  ];

  const clients = [];
  for (const c of clientsData) {
    const client = await prisma.client.upsert({
      where: { distributorId_rut: { distributorId: distributor.id, rut: c.rut } },
      update: c,
      create: { distributorId: distributor.id, ...c },
    });
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
  .catch((e) => {
   
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
