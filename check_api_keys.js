import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function check() {
  try {
    const keys = await prisma.apiKey.findMany({
      include: { user: { select: { name: true, email: true } } }
    });
    console.log('=== 当前API Keys ===');
    if (keys.length === 0) {
      console.log('没有找到API Key');
    } else {
      keys.forEach(k => {
        console.log(`- 用户: ${k.user.name} (${k.user.email})`);
        console.log(`  Key: ${k.key}`);
        console.log(`  状态: ${k.status}`);
        console.log('');
      });
    }
  } catch (e) {
    console.error('错误:', e.message);
  } finally {
    await prisma.$disconnect();
  }
}

check();
