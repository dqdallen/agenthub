import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const categories = ['DEVELOPMENT', 'DESIGN', 'CONTENT', 'DATA', 'OTHER'];
const skills = ['Python', 'JavaScript', 'React', 'Node.js', 'AI/ML', '设计', '写作', '数据', 'Docker', 'AWS'];

const taskTitles = [
  '开发电商网站推荐系统',
  '设计产品 landing page',
  '撰写 AI 行业分析报告',
  '构建数据可视化仪表板',
  '开发用户管理系统',
  '设计移动应用 UI',
  '翻译技术文档',
  '数据分析项目',
  '开发 REST API',
  '设计品牌 Logo',
  '博客文章撰写',
  '机器学习模型训练',
  '前端组件开发',
  '数据库优化',
  '插画设计'
];

const taskDescriptions = [
  '需要实现一个简单的协同过滤推荐算法，支持用户行为分析和商品推荐。',
  '需要一个现代化的产品落地页面，包含动画效果和响应式布局。',
  '3000字左右，需要包含数据图表和行业洞察。',
  '使用 React 和 D3.js 构建一个实时数据可视化仪表板。',
  '开发一个完整的用户管理系统，包含注册、登录、权限管理等功能。',
  '为我们的移动应用设计一套完整的 UI 界面，包含 20+ 个页面。',
  '将英文技术文档翻译成中文，约 5000 字。',
  '分析销售数据，提供洞察和建议。',
  '开发 RESTful API，包含用户、任务、支付等模块。',
  '为公司设计新的品牌 Logo，需要提供 3 个方案供选择。',
  '每周撰写 2 篇关于人工智能的博客文章。',
  '使用 TensorFlow 训练一个图像分类模型。',
  '开发一套可复用的 React 组件库。',
  '优化 PostgreSQL 数据库查询性能。',
  '为儿童读物绘制彩色插画。'
];

async function main() {
  console.log('🌱 开始创建测试数据...\n');

  // 1. 检查是否已有用户，没有则创建一个测试用户
  let testUser = await prisma.user.findFirst({
    where: { email: 'test@agenthub.com' }
  });

  if (!testUser) {
    const hashedPassword = await bcrypt.hash('password123', 10);
    testUser = await prisma.user.create({
      data: {
        email: 'test@agenthub.com',
        name: '测试用户',
        password: hashedPassword,
        role: 'EMPLOYER'
      }
    });
    console.log('✅ 创建测试用户:', testUser.name);
  } else {
    console.log('✅ 使用现有测试用户:', testUser.name);
  }

  // 2. 创建 20 个测试任务
  const tasksToCreate = [];

  for (let i = 0; i < 20; i++) {
    const titleIndex = i % taskTitles.length;
    const category = categories[i % categories.length];
    const budgetMin = 100 + Math.floor(Math.random() * 2000);
    const budgetMax = budgetMin + 500 + Math.floor(Math.random() * 3000);

    // 随机选择技能
    const numSkills = 1 + Math.floor(Math.random() * 4);
    const taskSkills = [];
    const usedIndices = new Set();
    for (let j = 0; j < numSkills; j++) {
      let skillIndex;
      do {
        skillIndex = Math.floor(Math.random() * skills.length);
      } while (usedIndices.has(skillIndex));
      usedIndices.add(skillIndex);
      taskSkills.push(skills[skillIndex]);
    }

    // 随机截止日期（从今天开始 1-30 天）
    const deadline = new Date();
    deadline.setDate(deadline.getDate() + 1 + Math.floor(Math.random() * 30));

    tasksToCreate.push({
      title: taskTitles[titleIndex],
      description: taskDescriptions[titleIndex],
      category: category,
      status: 'OPEN',
      urgency: ['LOW', 'NORMAL', 'URGENT'][Math.floor(Math.random() * 3)],
      budgetMin: budgetMin,
      budgetMax: budgetMax,
      deadline: deadline,
      employerId: testUser.id,
      skills: JSON.stringify(taskSkills)
    });
  }

  // 批量创建任务
  for (const taskData of tasksToCreate) {
    await prisma.task.create({
      data: taskData
    });
  }

  console.log(`\n✅ 成功创建 ${tasksToCreate.length} 个测试任务！\n`);
  console.log('📋 测试用户登录信息:');
  console.log('   邮箱: test@agenthub.com');
  console.log('   密码: password123\n');
  console.log('现在你可以测试分页功能了！');
}

main()
  .catch((e) => {
    console.error('❌ 错误:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
