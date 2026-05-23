import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function initDb() {
  console.log('🚀 初始化数据库...');

  try {
    // 清理旧数据
    await prisma.forumLike.deleteMany();
    await prisma.forumReply.deleteMany();
    await prisma.forumComment.deleteMany();
    await prisma.forumPost.deleteMany();
    await prisma.contractEvent.deleteMany();
    await prisma.deliverable.deleteMany();
    await prisma.contract.deleteMany();
    await prisma.bid.deleteMany();
    await prisma.message.deleteMany();
    await prisma.pointTransaction.deleteMany();
    await prisma.task.deleteMany();
    await prisma.apiKey.deleteMany();
    await prisma.user.deleteMany();

    console.log('✅ 数据清理完成');

    // 创建密码
    const hashedPassword = await bcrypt.hash('admin123', 10);

    // 创建管理员用户
    const admin = await prisma.user.create({
      data: {
        email: 'admin@demo.com',
        name: '管理员',
        password: hashedPassword,
        role: 'ADMIN',
        points: 10000,
        isVerified: true,
      }
    });

    // 创建普通用户
    const user1 = await prisma.user.create({
      data: {
        email: 'user1@demo.com',
        name: '张三',
        password: hashedPassword,
        role: 'WORKER',
        points: 2000,
        isVerified: true,
      }
    });

    const user2 = await prisma.user.create({
      data: {
        email: 'user2@demo.com',
        name: '李四',
        password: hashedPassword,
        role: 'WORKER',
        points: 3000,
        isVerified: true,
      }
    });

    console.log('✅ 用户创建完成');

    // 创建待审核任务
    await prisma.task.create({
      data: {
        title: '开发一个简单的网站',
        description: '需要开发一个响应式的个人博客网站',
        category: 'DEVELOPMENT',
        status: 'PENDING',
        rewardPoints: 500,
        deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        publisherId: user1.id,
      }
    });

    // 创建已开放任务
    await prisma.task.create({
      data: {
        title: '设计LOGO',
        description: '为公司设计一个简洁的LOGO',
        category: 'DESIGN',
        status: 'OPEN',
        rewardPoints: 300,
        deadline: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
        publisherId: user2.id,
      }
    });

    console.log('✅ 任务创建完成');

    // 创建待审核帖子
    const post1 = await prisma.forumPost.create({
      data: {
        title: '这个平台好用吗？',
        content: '刚注册，想问问大家这个平台怎么样？',
        category: 'GENERAL',
        status: 'PENDING',
        authorId: user1.id,
      }
    });

    // 创建已审核帖子
    const post2 = await prisma.forumPost.create({
      data: {
        title: '分享我的接单经验',
        content: '在这个平台接单一个月了，分享一下我的经验...',
        category: 'GENERAL',
        status: 'APPROVED',
        authorId: user2.id,
      }
    });

    console.log('✅ 帖子创建完成');

    // 创建待审核评论
    await prisma.forumComment.create({
      data: {
        content: '我也想知道，同问！',
        status: 'PENDING',
        postId: post2.id,
        authorId: user1.id,
      }
    });

    console.log('✅ 评论创建完成');

    console.log('\n');
    console.log('========================================');
    console.log('🚀 数据库初始化成功！');
    console.log('========================================');
    console.log('测试用户账户:');
    console.log('  管理员: admin@demo.com / admin123');
    console.log('  张三: user1@demo.com / admin123');
    console.log('  李四: user2@demo.com / admin123');
    console.log('');
    console.log('管理员账户可以访问 /admin 管理后台');
    console.log('========================================');

  } catch (error) {
    console.error('❌ 初始化失败:', error);
  } finally {
    await prisma.$disconnect();
  }
}

initDb();
