
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function setupTestUsers() {
  console.log('🧪 设置测试用户...\n');
  
  const hashedPassword = await bcrypt.hash('demo123', 10);
  
  // 更新现有用户的密码
  const users = await prisma.user.findMany();
  
  for (const user of users) {
    try {
      await prisma.user.update({
        where: { id: user.id },
        data: { password: hashedPassword }
      });
      console.log(`✅ ${user.name} (${user.email}) 密码已设置为 demo123`);
    } catch (e) {
      console.log(`⚠️  ${user.name} 更新失败:`, e.message);
    }
  }
  
  console.log('\n✅ 密码设置完成！');
  console.log('\n测试账号:');
  console.log('  管理员: admin@demo.com / demo123');
  console.log('  张三: user1@demo.com / demo123');
  console.log('  李四: user2@demo.com / demo123');
  
  await prisma.$disconnect();
}

setupTestUsers().catch(console.error);

