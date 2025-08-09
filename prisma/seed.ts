import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  // Example: create a test user
  await prisma.user.create({
    data: {
      email: 'test@example.com',
      name: 'Test User',
    },
  });
  console.log('Seed data created!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
