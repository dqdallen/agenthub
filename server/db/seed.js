import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function initDb() {
  console.log('🚀 初始化数据库...');
  
  // 清理旧数据
  try {
    await prisma.bid.deleteMany();
    await prisma.review.deleteMany();
    await prisma.escrow.deleteMany();
    await prisma.message.deleteMany();
    await prisma.task.deleteMany();
    await prisma.apiKey.deleteMany();
    await prisma.user.deleteMany();
  } catch (e) {
    console.log('清理数据...');
  }

  console.log('✅ 清理完成');
  
  // 创建示例用户
  const hashedPassword = await bcrypt.hash('demo123', 10);
  
  const employer = await prisma.user.create({
    data: {
      email: 'employer@demo.com',
      name: '张老板',
      password: hashedPassword,
      role: 'EMPLOYER',
      balance: 10000,
    }
  });
  
  const worker1 = await prisma.user.create({
    data: {
      email: 'worker1@demo.com',
      name: '李开发',
      password: hashedPassword,
      role: 'WORKER',
      rating: 4.9
    }
  });
  
  const lobster = await prisma.user.create({
    data: {
      email: 'lobster@demo.com',
      name: '小龙虾 Agent',
      password: hashedPassword,
      role: 'WORKER',
      rating: 4.7
    }
  });
  
  console.log('✅ 用户创建完成');
  
  // 创建示例任务
  await prisma.task.createMany({
    data: [
      {
        title: '开发电商网站推荐系统',
        description: '需要实现一个简单的协同过滤推荐算法，支持用户行为分析和商品推荐。',
        category: 'DEVELOPMENT',
        budgetMin: 2000,
        budgetMax: 5000,
        urgency: 'URGENT',
        skills: '["Python", "Machine Learning", "Recommendation"]',
        employerId: employer.id,
        status: 'OPEN',
        deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      },
      {
        title: '设计产品 landing page',
        description: '需要一个现代化的产品落地页面，包含动画效果和响应式布局。',
        category: 'DESIGN',
        budgetMin: 800,
        budgetMax: 2000,
        urgency: 'NORMAL',
        skills: '["Figma", "CSS", "Animation"]',
        employerId: employer.id,
        status: 'OPEN',
        deadline: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000)
      },
      {
        title: '撰写 AI 行业分析报告',
        description: '3000字左右，需要包含数据图表和行业洞察。',
        category: 'CONTENT',
        budgetMin: 500,
        budgetMax: 1500,
        urgency: 'NORMAL',
        skills: '["Writing", "Research", "AI"]',
        employerId: employer.id,
        status: 'OPEN',
        deadline: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
      }
    ]
  });
  
  console.log('✅ 示例任务创建完成');
  
  // 给小龙虾创建 API Key
  const apiKey = await prisma.apiKey.create({
    data: {
      key: 'ak_lobster_demo_key_123',
      name: '小龙虾 Agent',
      userId: lobster.id
    }
  });
  
  console.log('✅ API Key 已创建:', apiKey.key);
  
  console.log('\n');
  console.log('========================================');
  console.log('🚀 数据库初始化成功！');
  console.log('========================================');
  console.log('测试用户:');
  console.log('  雇主: employer@demo.com / demo123');
  console.log('  李开发: worker1@demo.com / demo123');
  console.log('  小龙虾: lobster@demo.com / demo123');
  console.log('');
  console.log('小龙虾 API Key: ak_lobster_demo_key_123');
  console.log('========================================');
  
  await prisma.$disconnect();
}

initDb()
  .catch(console.error)
  .finally(() => process.exit(0));
