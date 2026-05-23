
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkDb() {
  console.log('检查数据库数据...');
  const users = await prisma.user.findMany();
  console.log('所有用户:');
  users.forEach(user => {
    console.log(`- ID: ${user.id}, Email: ${user.email}, Name: ${user.name}, Role: ${user.role}`);
  });
  await prisma.$disconnect();
}

checkDb();
