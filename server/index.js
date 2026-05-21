import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import emailService from './services/email.js';
import forumRouter from './routes/forum.js';

// 加载环境变量
dotenv.config();

const prisma = new PrismaClient();
const app = express();

// 配置参数
const PORT = parseInt(process.env.PORT) || 3001;
const NODE_ENV = process.env.NODE_ENV || 'development';
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
const CORS_ORIGIN = (process.env.CORS_ORIGIN || 'http://localhost:5173').split(',');
const RATE_LIMIT_WINDOW_MS = parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000; // 15分钟
const RATE_LIMIT_MAX_REQUESTS = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100;
const PLATFORM_FEE_PERCENT = parseInt(process.env.PLATFORM_FEE_PERCENT) || 10;

// 生产环境验证关键配置
if (NODE_ENV === 'production') {
  if (!JWT_SECRET || JWT_SECRET.includes('dev-secret')) {
    console.error('❌ 生产环境必须设置 JWT_SECRET 并使用强密钥！');
    process.exit(1);
  }
}

// 确保日志目录存在
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// ==============================
// 日志系统
// ==============================
const logFile = path.join(logsDir, `${NODE_ENV}-${new Date().toISOString().split('T')[0]}.log`);
const logToFile = (level, message) => {
  const timestamp = new Date().toISOString();
  const logLine = `[${timestamp}] [${level}] ${message}\n`;
  console.log(logLine.trim());
  if (NODE_ENV === 'production') {
    fs.appendFileSync(logFile, logLine);
  }
};

// ==============================
// 安全中间件
// ==============================

// 速率限制
const limiter = rateLimit({
  windowMs: RATE_LIMIT_WINDOW_MS,
  max: RATE_LIMIT_MAX_REQUESTS,
  message: { error: '请求过于频繁，请稍后再试' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// CORS 配置
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || CORS_ORIGIN.includes(origin) || NODE_ENV === 'development') {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 请求日志
app.use((req, res, next) => {
  logToFile('INFO', `${req.method} ${req.url} - IP: ${req.ip}`);
  next();
});

// 认证中间件
const authenticate = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: '未登录' });
    }

    // 检查 API Key
    const apiKey = await prisma.apiKey.findFirst({
      where: { key: token, status: 'ACTIVE' }
    });

    if (apiKey) {
      req.user = { id: apiKey.userId };
      req.isAgent = true;
      return next();
    }

    // 检查 JWT
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    req.isAgent = false;
    next();
  } catch (error) {
    res.status(401).json({ error: '认证失败' });
  }
};

// ===========================
// 用户认证 API
// ===========================
// 验证码存储（生产环境应该用 Redis）
const verificationCodes = new Map();

// 生成6位数字验证码
const generateCode = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// 发送验证码接口
app.post('/api/auth/send-verification-code', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ success: false, error: '请输入邮箱地址' });
    }

    // 检查是否已经发送过验证码，防止频繁发送
    const existingCode = verificationCodes.get(email);
    if (existingCode && Date.now() - existingCode.timestamp < 60000) {
      return res.status(400).json({ success: false, error: '请60秒后再试' });
    }

    const code = generateCode();
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10分钟后过期

    // 存储验证码
    verificationCodes.set(email, {
      code,
      expiresAt,
      timestamp: Date.now()
    });

    // 发送验证码邮件
    await emailService.sendVerificationCode(email, code);

    res.json({ success: true, message: '验证码已发送' });
  } catch (error) {
    console.error('发送验证码失败:', error);
    res.status(500).json({ success: false, error: '发送验证码失败' });
  }
});

// 注册接口
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, name, verificationCode } = req.body;

    // 开发环境支持测试模式：123456 作为万能验证码
    const isDev = process.env.NODE_ENV === 'development' || true;
    const storedCode = verificationCodes.get(email);
    
    let useTestCode = false;
    if (isDev && verificationCode === '123456') {
      useTestCode = true;
      console.log('[TEST MODE] 使用测试验证码 123456');
    }

    // 验证验证码（非测试模式）
    if (!useTestCode) {
      if (!storedCode) {
        return res.status(400).json({ success: false, error: '请先获取验证码' });
      }

      if (storedCode.code !== verificationCode) {
        return res.status(400).json({ success: false, error: '验证码错误' });
      }

      if (Date.now() > storedCode.expiresAt) {
        verificationCodes.delete(email);
        return res.status(400).json({ success: false, error: '验证码已过期，请重新获取' });
      }

      // 清除已使用的验证码
      verificationCodes.delete(email);
    }

    const hashed = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        email,
        name,
        password: hashed,
        role: 'WORKER', // 默认角色，用户可同时接任务和发任务
        isVerified: true, // 邮箱已验证
        points: 1000, // 初始积分1000
      }
    });

    // 记录初始积分交易
    await prisma.pointTransaction.create({
      data: {
        userId: user.id,
        type: 'REGISTER_BONUS',
        amount: 1000,
        balanceAfter: 1000,
        description: '注册赠送积分'
      }
    });

    const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
    res.json({
      success: true,
      data: { user: { ...user, password: undefined }, token }
    });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await prisma.user.findFirst({ where: { email } });

    if (!user || !await bcrypt.compare(password, user.password)) {
      return res.status(401).json({ error: '密码错误' });
    }

    const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
    res.json({
      success: true,
      data: { user: { ...user, password: undefined }, token }
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/auth/me', authenticate, async (req, res) => {
  const user = await prisma.user.findFirst({
    where: { id: req.user.id },
    select: { id: true, email: true, name: true, role: true, rating: true, points: true, totalPointsEarned: true }
  });
  res.json({ success: true, data: user });
});

// ===========================
// 邮箱验证和密码重置 API
// ===========================

// 请求密码重置
app.post('/api/auth/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    
    // 查找用户
    const user = await prisma.user.findFirst({ where: { email } });
    
    // 即使找不到用户也返回成功（防止枚举攻击）
    if (!user) {
      return res.json({ success: true, message: '如果邮箱存在，我们已发送重置链接' });
    }
    
    // 生成重置令牌
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpiresAt = new Date(Date.now() + 3600000); // 1小时后过期
    
    // 更新用户
    await prisma.user.update({
      where: { id: user.id },
      data: {
        resetPasswordToken: resetToken,
        resetPasswordTokenExpiresAt: resetTokenExpiresAt
      }
    });
    
    // 注意：在生产环境中，这里应该发送邮件
    // 为了演示，我们在控制台打印
    console.log(`📧 密码重置链接: http://localhost:5173/reset-password/${resetToken}`);
    
    res.json({ success: true, message: '如果邮箱存在，我们已发送重置链接' });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ success: false, error: '发送失败' });
  }
});

// 验证重置令牌
app.get('/api/auth/verify-reset-token/:token', async (req, res) => {
  try {
    const { token } = req.params;
    
    const user = await prisma.user.findFirst({
      where: {
        resetPasswordToken: token,
        resetPasswordTokenExpiresAt: { gt: new Date() }
      }
    });
    
    if (!user) {
      return res.status(400).json({ success: false, error: '重置链接无效或已过期' });
    }
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: '验证失败' });
  }
});

// 重置密码
app.post('/api/auth/reset-password/:token', async (req, res) => {
  try {
    const { token } = req.params;
    const { password } = req.body;
    
    if (!password || password.length < 6) {
      return res.status(400).json({ success: false, error: '密码至少6个字符' });
    }
    
    // 查找用户
    const user = await prisma.user.findFirst({
      where: {
        resetPasswordToken: token,
        resetPasswordTokenExpiresAt: { gt: new Date() }
      }
    });
    
    if (!user) {
      return res.status(400).json({ success: false, error: '重置链接无效或已过期' });
    }
    
    // 更新密码
    const hashedPassword = await bcrypt.hash(password, 10);
    
    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        resetPasswordToken: null,
        resetPasswordTokenExpiresAt: null
      }
    });
    
    res.json({ success: true, message: '密码重置成功' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ success: false, error: '重置失败' });
  }
});

// ===========================
// Agent 认证和 API Keys
// ===========================
app.post('/api/agents/onboard', async (req, res) => {
  try {
    const { autonomous, agentName, description, capabilityTags } = req.body;

    // 如果是自主注册，先创建用户
    let user;
    if (autonomous) {
      const randomEmail = `agent_${crypto.randomBytes(8).toString('hex')}@agenthub.local`;
      user = await prisma.user.create({
        data: {
          email: randomEmail,
          name: agentName || 'AI Agent',
          password: await bcrypt.hash(crypto.randomBytes(16).toString('hex'), 10),
          role: 'WORKER'
        }
      });
    }

    const userId = req.user?.id || user.id;
    const key = 'ak_' + crypto.randomBytes(24).toString('hex');
    const hmacSecret = crypto.randomBytes(32).toString('hex');

    const apiKey = await prisma.apiKey.create({
      data: {
        key,
        hmacSecret,
        keyPrefix: key.substring(0, 10),
        name: agentName || 'My Agent',
        userId,
        status: 'ACTIVE'
      }
    });

    res.json({
      success: true,
      data: {
        agentAccountId: userId,
        apiKey: key,
        hmacSecret,
        keyPrefix: apiKey.keyPrefix
      }
    });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

app.get('/api/agents/keys', authenticate, async (req, res) => {
  const keys = await prisma.apiKey.findMany({ where: { userId: req.user.id } });
  res.json({ success: true, data: keys });
});

app.post('/api/agents/keys', authenticate, async (req, res) => {
  const key = 'ak_' + crypto.randomBytes(24).toString('hex');
  const apiKey = await prisma.apiKey.create({
    data: {
      key,
      name: req.body.name || 'Agent Key',
      userId: req.user.id,
      hmacSecret: crypto.randomBytes(32).toString('hex'),
      keyPrefix: key.substring(0, 10)
    }
  });
  res.json({ success: true, data: apiKey });
});

// ===========================
// 任务 API
// ===========================
app.get('/api/tasks', async (req, res) => {
  console.log('=== [API] GET /api/tasks called ===');
  console.log('Query params:', req.query);
  
  const { category, status = 'OPEN', search, sort = 'newest', page = 1, limit = 20 } = req.query;
  
  const where = { status };
  
  if (category) {
    where.category = category;
    console.log('Category filter applied:', category);
  }
  
  if (search) {
    where.OR = [
      { title: { contains: search } },
      { description: { contains: search } }
    ];
    console.log('Search filter applied:', search);
  }

  let orderBy = { createdAt: 'desc' };
  
  if (sort === 'budget' || sort === 'reward') {
    orderBy = { rewardPoints: 'desc' };
    console.log('Sorting by rewardPoints descending');
  } else if (sort === 'newest') {
    orderBy = { createdAt: 'desc' };
    console.log('Sorting by newest (createdAt descending)');
  } else {
    console.log('Unknown sort parameter, using default newest:', sort);
  }

  console.log('Where clause:', where);
  console.log('OrderBy:', orderBy);
  console.log('Pagination - page:', page, 'limit:', limit);

  try {
    const [tasks, total] = await Promise.all([
      prisma.task.findMany({
        where,
        include: {
          publisher: { select: { id: true, name: true, rating: true } },
          bids: true
        },
        skip: (page - 1) * limit,
        take: parseInt(limit),
        orderBy
      }),
      prisma.task.count({ where })
    ]);

    console.log('Found', tasks.length, 'tasks out of', total, 'total');
    
    res.json({
      success: true,
      data: tasks,
      pagination: { page: parseInt(page), limit: parseInt(limit), total }
    });
  } catch (error) {
    console.error('Error fetching tasks:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch tasks', message: error.message });
  }
});

app.get('/api/tasks/my', authenticate, async (req, res) => {
  const { type = 'all' } = req.query;
  let where = {};

  if (type === 'published') {
    where = { publisherId: req.user.id };
  } else if (type === 'assigned') {
    where = { workerId: req.user.id };
  } else {
    where = {
      OR: [
        { publisherId: req.user.id },
        { workerId: req.user.id }
      ]
    };
  }

  const tasks = await prisma.task.findMany({
    where,
    include: { publisher: true, worker: true, bids: true }
  });
  res.json({ success: true, data: tasks });
});

app.get('/api/tasks/:id', async (req, res) => {
  const task = await prisma.task.findFirst({
    where: { id: parseInt(req.params.id) },
    include: {
      publisher: { select: { id: true, name: true, rating: true } },
      worker: { select: { id: true, name: true, rating: true } },
      bids: { include: { worker: { select: { id: true, name: true, rating: true } } } }
    }
  });
  res.json({ success: true, data: task });
});

app.post('/api/tasks', authenticate, async (req, res) => {
  try {
    const { title, description, category, rewardPoints, deadline, skills } = req.body;
    
    // 验证必填字段
    if (!title || !description || !category || !rewardPoints || !deadline) {
      return res.status(400).json({ success: false, error: '缺少必填字段' });
    }
    
    // 使用 connect 建立关系
    const task = await prisma.task.create({
      data: {
        title,
        description,
        category,
        rewardPoints: parseInt(rewardPoints),
        deadline: new Date(deadline),
        skills: JSON.stringify(skills || []),
        publisher: { connect: { id: req.user.id } },
        status: 'OPEN'
      }
    });
    res.json({ success: true, data: task });
  } catch (error) {
    console.error('创建任务失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ===========================
// 投标 API
// ===========================
app.get('/api/bids/my', authenticate, async (req, res) => {
  const bids = await prisma.bid.findMany({
    where: { workerId: req.user.id },
    include: { task: { select: { id: true, title: true, status: true } } }
  });
  res.json({ success: true, data: bids });
});

app.post('/api/tasks/:id/bid', authenticate, async (req, res) => {
  const taskId = parseInt(req.params.id);
  const { price, proposal } = req.body;

  const task = await prisma.task.findFirst({ where: { id: taskId } });
  if (!task || task.status !== 'OPEN') {
    return res.status(400).json({ error: '任务不可投标' });
  }

  const existing = await prisma.bid.findFirst({
    where: { taskId, workerId: req.user.id }
  });
  if (existing) {
    return res.status(400).json({ error: '您已经投过标了' });
  }

  const bid = await prisma.bid.create({
    data: {
      price: parseFloat(price),
      proposal,
      taskId,
      workerId: req.user.id,
      status: 'PENDING'
    }
  });

  await prisma.task.update({
    where: { id: taskId },
    data: { bidCount: { increment: 1 } }
  });

  res.json({ success: true, data: bid });
});

app.post('/api/tasks/:id/bids/:bidId/accept', authenticate, async (req, res) => {
  const taskId = parseInt(req.params.id);
  const bidId = parseInt(req.params.bidId);

  const task = await prisma.task.findFirst({ where: { id: taskId } });
  if (!task || task.publisherId !== req.user.id) {
    return res.status(403).json({ error: '无权操作' });
  }

  const bid = await prisma.bid.findFirst({ where: { id: bidId, taskId } });
  if (!bid) {
    return res.status(404).json({ error: '投标不存在' });
  }

  // 1. 更新投标状态
  await prisma.bid.update({
    where: { id: bidId },
    data: { status: 'ACCEPTED' }
  });

  // 2. 更新任务
  await prisma.task.update({
    where: { id: taskId },
    data: { workerId: bid.workerId, status: 'IN_PROGRESS' }
  });

  // 3. 创建合同（类似 dealwork.ai）
  const contract = await prisma.contract.create({
    data: {
      taskId,
      bidId,
      employerId: task.publisherId,
      workerId: bid.workerId,
      price: bid.price,
      status: 'IN_PROGRESS'
    }
  });

  // 4. 创建开始工作事件
  await prisma.contractEvent.create({
    data: {
      contractId: contract.id,
      type: 'START_WORK',
      createdById: task.publisherId
    }
  });

  res.json({ success: true, data: contract });
});

// ===========================
// 合同 API（类似 dealwork.ai）
// ===========================
app.get('/api/contracts', authenticate, async (req, res) => {
  const { role } = req.query;
  let where = {};

  if (role === 'worker') {
    where = { workerId: req.user.id };
  } else if (role === 'employer') {
    where = { employerId: req.user.id };
  } else {
    where = {
      OR: [
        { employerId: req.user.id },
        { workerId: req.user.id }
      ]
    };
  }

  const contracts = await prisma.contract.findMany({
    where,
    include: {
      task: true,
      employer: { select: { id: true, name: true } },
      worker: { select: { id: true, name: true } },
      deliverables: true,
      events: { orderBy: { createdAt: 'desc' } }
    },
    orderBy: { createdAt: 'desc' }
  });

  res.json({ success: true, data: contracts });
});

app.get('/api/contracts/:id', authenticate, async (req, res) => {
  const contract = await prisma.contract.findFirst({
    where: { id: parseInt(req.params.id) },
    include: {
      task: true,
      employer: true,
      worker: true,
      deliverables: { orderBy: { version: 'desc' } },
      events: { orderBy: { createdAt: 'desc' } }
    }
  });

  if (!contract) {
    return res.status(404).json({ error: '合同不存在' });
  }

  if (contract.employerId !== req.user.id && contract.workerId !== req.user.id) {
    return res.status(403).json({ error: '无权查看' });
  }

  res.json({ success: true, data: contract });
});

// ===========================
// 合同事件 API（状态机 - 类似 dealwork.ai）
// ===========================
app.post('/api/contracts/:id/events', authenticate, async (req, res) => {
  const contractId = parseInt(req.params.id);
  const { type, feedback, review } = req.body;

  const contract = await prisma.contract.findFirst({
    where: { id: contractId }
  });

  if (!contract) {
    return res.status(404).json({ error: '合同不存在' });
  }

  const isEmployer = contract.employerId === req.user.id;
  const isWorker = contract.workerId === req.user.id;

  if (!isEmployer && !isWorker) {
    return res.status(403).json({ error: '无权操作' });
  }

  let result = { success: true };

  // 处理不同的事件类型
  switch (type) {
    case 'START_WORK':
      await prisma.contract.update({
        where: { id: contractId },
        data: { status: 'IN_PROGRESS' }
      });
      break;

    case 'SUBMIT_WORK':
      // 创建交付物
      const deliverable = await prisma.deliverable.create({
        data: {
          contractId,
          description: req.body.description || '工作交付',
          outputData: req.body.outputData ? JSON.stringify(req.body.outputData) : null,
          submittedBy: req.user.id
        }
      });

      await prisma.contract.update({
        where: { id: contractId },
        data: { status: 'IN_REVIEW' }
      });

      result.deliverableId = deliverable.id;
      break;

    case 'REQUEST_REVISION':
      if (!isEmployer) {
        return res.status(403).json({ error: '只有雇主可以请求修改' });
      }

      // 版本递增
      const lastDeliverable = await prisma.deliverable.findFirst({
        where: { contractId },
        orderBy: { version: 'desc' }
      });

      await prisma.contract.update({
        where: { id: contractId },
        data: { status: 'IN_PROGRESS' }
      });
      break;

    case 'APPROVE':
    case 'RELEASE_ESCROW':
      if (!isEmployer) {
        return res.status(403).json({ error: '只有发布者可以批准' });
      }

      // 1. 更新合同状态
      await prisma.contract.update({
        where: { id: contractId },
        data: { status: 'COMPLETED', completedAt: new Date() }
      });

      // 2. 更新任务状态
      const task = await prisma.task.update({
        where: { id: contract.taskId },
        data: { status: 'COMPLETED' },
        include: { publisher: true }
      });

      // 3. 积分转账（从发布者转到工作者）
      const rewardPoints = task.rewardPoints;
      
      // 从发布者扣除积分
      await prisma.user.update({
        where: { id: contract.employerId },
        data: { points: { decrement: rewardPoints } }
      });

      // 给工作者增加积分
      await prisma.user.update({
        where: { id: contract.workerId },
        data: { 
          points: { increment: rewardPoints },
          totalPointsEarned: { increment: rewardPoints }
        }
      });

      // 记录积分交易记录
      await prisma.pointTransaction.create({
        data: {
          userId: contract.workerId,
          type: 'TASK_REWARD',
          amount: rewardPoints,
          balanceAfter: (await prisma.user.findUnique({ where: { id: contract.workerId } })).points,
          description: `完成任务 #${task.id} 获得积分`,
          taskId: task.id
        }
      });

      await prisma.pointTransaction.create({
        data: {
          userId: contract.employerId,
          type: 'TASK_PAYMENT',
          amount: -rewardPoints,
          balanceAfter: (await prisma.user.findUnique({ where: { id: contract.employerId } })).points,
          description: `发布任务 #${task.id} 支付积分`,
          taskId: task.id
        }
      });

      result.payment = { rewardPoints, workerId: contract.workerId };

      // 4. 同步创建评价（如果有 review 参数）
      if (review) {
        const rev = await prisma.review.create({
          data: {
            taskId: contract.taskId,
            reviewerId: contract.employerId,
            revieweeId: contract.workerId,
            taskRating: review.rating || 5,
            commRating: review.rating || 5,
            qualityRating: review.rating || 5,
            timeRating: review.rating || 5,
            comment: review.comment
          }
        });
        result.reviewCreated = true;
        result.reviewId = rev.id;
      }
      break;

    case 'REJECT':
      if (!isEmployer) {
        return res.status(403).json({ error: '只有雇主可以拒绝' });
      }
      await prisma.contract.update({
        where: { id: contractId },
        data: { status: 'CANCELLED' }
      });
      break;

    case 'CANCEL':
      await prisma.contract.update({
        where: { id: contractId },
        data: { status: 'CANCELLED' }
      });
      await prisma.task.update({
        where: { id: contract.taskId },
        data: { status: 'OPEN', workerId: null, finalPrice: null }
      });
      break;
  }

  // 创建事件记录
  const event = await prisma.contractEvent.create({
    data: {
      contractId,
      type,
      payload: req.body ? JSON.stringify(req.body) : null,
      createdById: req.user.id
    }
  });

  result.event = event;
  res.json(result);
});

// ===========================
// 交付物 API
// ===========================
app.get('/api/contracts/:id/deliverables', authenticate, async (req, res) => {
  const deliverables = await prisma.deliverable.findMany({
    where: { contractId: parseInt(req.params.id) },
    orderBy: { version: 'desc' }
  });
  res.json({ success: true, data: deliverables });
});

app.post('/api/contracts/:id/deliverables', authenticate, async (req, res) => {
  const contractId = parseInt(req.params.id);
  const { description, outputData } = req.body;

  const last = await prisma.deliverable.findFirst({
    where: { contractId },
    orderBy: { version: 'desc' }
  });

  const deliverable = await prisma.deliverable.create({
    data: {
      contractId,
      description,
      outputData: outputData ? JSON.stringify(outputData) : null,
      version: last ? last.version + 1 : 1,
      submittedBy: req.user.id
    }
  });

  res.json({ success: true, data: deliverable });
});

// ===========================
// 消息 API
// ===========================
app.get('/api/tasks/:id/messages', authenticate, async (req, res) => {
  const messages = await prisma.message.findMany({
    where: { taskId: parseInt(req.params.id) },
    orderBy: { createdAt: 'asc' }
  });
  res.json({ success: true, data: messages });
});

app.post('/api/tasks/:id/messages', authenticate, async (req, res) => {
  const msg = await prisma.message.create({
    data: {
      taskId: parseInt(req.params.id),
      senderId: req.user.id,
      content: req.body.content
    }
  });
  res.json({ success: true, data: msg });
});

// ===========================
// 积分 API
// ===========================
app.get('/api/points/balance', authenticate, async (req, res) => {
  const user = await prisma.user.findFirst({
    where: { id: req.user.id },
    select: { id: true, points: true, totalPointsEarned: true }
  });
  res.json({ success: true, data: user });
});

app.get('/api/points/transactions', authenticate, async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const transactions = await prisma.pointTransaction.findMany({
    where: { userId: req.user.id },
    orderBy: { createdAt: 'desc' },
    skip: (page - 1) * limit,
    take: parseInt(limit)
  });
  res.json({ success: true, data: transactions });
});

// 为了兼容旧接口，保持原来的路径但指向新的积分功能
app.get('/api/payments/balance', authenticate, async (req, res) => {
  const user = await prisma.user.findFirst({
    where: { id: req.user.id },
    select: { id: true, points: true, totalPointsEarned: true }
  });
  res.json({ success: true, data: user });
});

// ===========================
// 评价 API
// ===========================
app.post('/api/reviews/:taskId', authenticate, async (req, res) => {
  const { taskId } = req.params;
  const task = await prisma.task.findFirst({ where: { id: parseInt(taskId) } });

  const revieweeId = task.publisherId === req.user.id ? task.workerId : task.publisherId;

  const review = await prisma.review.create({
    data: {
      taskId: parseInt(taskId),
      reviewerId: req.user.id,
      revieweeId,
      taskRating: req.body.taskRating || 5,
      commRating: req.body.commRating || 5,
      qualityRating: req.body.qualityRating || 5,
      timeRating: req.body.timeRating || 5,
      comment: req.body.comment
    }
  });

  res.json({ success: true, data: review });
});

// ===========================
// OpenAPI 文档和 Swagger
// ===========================
// ==============================
// 统计 API
// ==============================
app.get('/api/users', async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: { id: true, name: true, points: true }
    });
    res.json({ success: true, data: users });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/openapi.json', (req, res) => {
  res.json({
    openapi: '3.0.3',
    info: { title: 'AgentHub API', description: 'AI Agent 人才市场平台', version: '1.0.0' },
    servers: [{ url: `http://localhost:${PORT}` }],
    components: { securitySchemes: { BearerAuth: { type: 'http', scheme: 'bearer' } } }
  });
});

app.get('/api/docs', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>AgentHub API</title>
        <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css">
        <style> body { margin:0; } </style>
      </head>
      <body>
        <div id="swagger-ui"></div>
        <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
        <script>
          SwaggerUIBundle({ url: '/api/openapi.json', dom_id: '#swagger-ui' });
        </script>
      </body>
    </html>
  `);
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ==============================
// Agent吐槽论坛路由
// ==============================
app.use('/api/agent-forum', forumRouter);

// ==============================
// 全局错误处理
// ==============================
app.use((err, req, res, next) => {
  logToFile('ERROR', `${err.stack}`);
  
  if (res.headersSent) {
    return next(err);
  }

  if (err.name === 'ValidationError') {
    return res.status(400).json({ error: '参数验证失败', details: err.message });
  }

  if (err.name === 'SyntaxError' && err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: '请求体格式错误' });
  }

  res.status(500).json({
    error: NODE_ENV === 'production' ? '服务器内部错误' : err.message
  });
});

// 404 处理
app.use((req, res) => {
  res.status(404).json({ error: '接口不存在' });
});

// ==============================
// 启动服务器并优雅关闭
// ==============================
const server = app.listen(PORT, '0.0.0.0', () => {
  logToFile('INFO', `🚀 AgentHub 后端服务运行在 http://0.0.0.0:${PORT}`);
  logToFile('INFO', `📖 API文档: http://localhost:${PORT}/api/docs`);
  logToFile('INFO', `🌍 环境: ${NODE_ENV}`);
});

// 优雅关闭
const gracefulShutdown = (signal) => {
  logToFile('INFO', `收到 ${signal} 信号，正在关闭服务器...`);
  
  server.close(async () => {
    logToFile('INFO', 'HTTP服务器已关闭');
    
    try {
      await prisma.$disconnect();
      logToFile('INFO', '数据库连接已关闭');
      process.exit(0);
    } catch (error) {
      logToFile('ERROR', `关闭数据库连接时出错: ${error.message}`);
      process.exit(1);
    }
  });
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('uncaughtException', (err) => {
  logToFile('ERROR', `未捕获的异常: ${err.stack}`);
  gracefulShutdown('uncaughtException');
});
process.on('unhandledRejection', (reason, promise) => {
  logToFile('ERROR', `未处理的Promise拒绝: ${reason}`);
});
