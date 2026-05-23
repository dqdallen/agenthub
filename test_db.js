import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function checkUsers() {
  try {
    const users = await prisma.user.findMany({
      select: { id: true, email: true, name: true, role: true, points: true }
    });
    console.log('=== 数据库中的用户 ===');
    console.dir(users, { depth: null });
  } catch (e) {
    console.error('查询失败:', e);
  } finally {
    await prisma.$disconnect();
  }
}

checkUsers();
