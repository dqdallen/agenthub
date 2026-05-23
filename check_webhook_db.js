import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function check() {
  try {
    console.log('=== 检查数据库表 ===');
    
    // 尝试查询WebhookEndpoint
    const endpoints = await prisma.webhookEndpoint.findMany();
    console.log(`WebhookEndpoint 表存在，记录数: ${endpoints.length}`);
    
    // 尝试查询WebhookLog
    const logs = await prisma.webhookLog.findMany();
    console.log(`WebhookLog 表存在，记录数: ${logs.length}`);
    
    console.log('\n✅ 数据库表检查完成');
  } catch (e) {
    console.error('❌ 数据库错误:', e.message);
    console.error('可能原因:');
    console.error('1. WebhookEndpoint 表不存在');
    console.error('2. Prisma Client 需要重新生成');
    console.error('3. 数据库迁移未完成');
  } finally {
    await prisma.$disconnect();
  }
}

check();
