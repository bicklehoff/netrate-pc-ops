// Prisma Seed Script — Create initial MLO accounts
// Run with: node prisma/seed.mjs
//
// Seeds David (admin) and Jamie (MLO) per architecture plan.
// Passwords should be changed after first login.

import 'dotenv/config';
import { PrismaClient } from '../src/generated/prisma/client.ts';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding MLO accounts...');

  // David Burson — Admin
  const davidPassword = await bcrypt.hash('changeme-david', 12);
  const david = await prisma.mlo.upsert({
    where: { email: 'david@netratemortgage.com' },
    update: {},
    create: {
      email: 'david@netratemortgage.com',
      firstName: 'David',
      lastName: 'Burson',
      passwordHash: davidPassword,
      role: 'admin',
    },
  });
  console.log(`  OK David Burson (admin): ${david.id}`);

  // Jamie — MLO
  const jamiePassword = await bcrypt.hash('changeme-jamie', 12);
  const jamie = await prisma.mlo.upsert({
    where: { email: 'jamie@netratemortgage.com' },
    update: {},
    create: {
      email: 'jamie@netratemortgage.com',
      firstName: 'Jamie',
      lastName: 'NetRate',
      passwordHash: jamiePassword,
      role: 'mlo',
    },
  });
  console.log(`  OK Jamie (mlo): ${jamie.id}`);

  console.log('Done! Remember to change default passwords.');
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
