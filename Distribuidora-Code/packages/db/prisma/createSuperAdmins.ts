import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';

const prisma = new PrismaClient();

/**
 * Script one-off para crear (o resetear la contraseña de) las cuentas de
 * super admin de los 3 socios. No hay alta de super admin desde la UI a
 * propósito — son cuentas sensibles, se provisionan corriendo esto a mano.
 *
 * Genera una contraseña aleatoria para cada cuenta y la imprime UNA sola vez
 * acá en la consola (no queda guardada en ningún lado en texto plano). Cada
 * uno debería entrar y, desde "Mi cuenta" en el panel, cambiar esa
 * contraseña por una propia y, si corresponde, actualizar su email al real.
 *
 * Correr con: npm run create-admins --workspace=packages/db
 */

function randomPassword(): string {
  return crypto.randomBytes(9).toString('base64').replace(/[^a-zA-Z0-9]/g, '').slice(0, 12);
}

async function upsertAdmin(email: string, name: string): Promise<{ email: string; password: string }> {
  const password = randomPassword();
  const hashed = await bcrypt.hash(password, 10);

  await prisma.platformAdmin.upsert({
    where: { email },
    update: { password: hashed, name },
    create: { email, password: hashed, name },
  });

  return { email, password };
}

async function main(): Promise<void> {
  const results = await Promise.all([
    upsertAdmin('ianbritos79@gmail.com', 'Leandro'),
    upsertAdmin('socio1@stockapp.com', 'Socio 1'),
    upsertAdmin('socio2@stockapp.com', 'Socio 2'),
  ]);

  console.log('\nCuentas de Super Admin creadas/reseteadas. Guardá esto — no se vuelve a mostrar:\n');
  for (const r of results) {
    console.log(`  ${r.email}  →  ${r.password}`);
  }
  console.log(
    '\nLas cuentas "socio1@stockapp.com" y "socio2@stockapp.com" son placeholders: cuando cada uno' +
      ' de tus compañeros tenga acceso, que entre con esos datos y desde "Mi cuenta" cambie el email' +
      ' al suyo real y elija su propia contraseña.\n'
  );
}

main()
  .catch((e) => {
    console.error('Error al crear las cuentas de super admin:', e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
