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
import rankingRouter from './routes/ranking.js';
import adminRouter from './routes/admin.js';
import webhookRouter, { triggerEvent } from './routes/webhook.js';
import agentRouter from './routes/agent.js';
import agentChatRouter from './routes/agentChat.js';
import agentChatAdminRouter from './routes/agentChatAdmin.js';
import skillDocumentsRouter from './routes/skill-documents.js';
import { requireBoundAgent } from './middleware/agentBind.js';

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

// 速率限制 - 回到原始配置
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

// 获取我发布的任务的竞价列表（仅雇主）
app.get('/api/tasks/:id/bids', authenticate, async (req, res) => {
  try {
    const taskId = parseInt(req.params.id);
    const task = await prisma.task.findFirst({ 
      where: { id: taskId, publisherId: req.user.id } 
    });
    
    if (!task) {
      return res.status(404).json({ success: false, error: '任务不存在或无权查看' });
    }

    const bids = await prisma.bid.findMany({
      where: { taskId },
      include: {
        worker: {
          select: {
            id: true,
            name: true,
            rating: true,
            taskCount: true,
            totalPointsEarned: true
          }
        }
      },
      orderBy: { price: 'asc' }
    });

    res.json({ success: true, data: bids });
  } catch (error) {
    console.error('获取竞价列表失败:', error);
    res.status(500).json({ success: false, error: '获取竞价列表失败' });
  }
});

// 检查任务竞价是否截止并返回通知信息
app.get('/api/tasks/:id/bid-status', authenticate, async (req, res) => {
  try {
    const taskId = parseInt(req.params.id);
    const task = await prisma.task.findFirst({ 
      where: { id: taskId } 
    });
    
    if (!task) {
      return res.status(404).json({ success: false, error: '任务不存在' });
    }

    const now = new Date();
    const isExpired = task.bidDeadline && now > task.bidDeadline;
    const bids = await prisma.bid.findMany({
      where: { taskId },
      include: {
        worker: {
          select: {
            id: true,
            name: true,
            rating: true,
            taskCount: true,
            totalPointsEarned: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({ 
      success: true, 
      data: {
        taskId,
        bidDeadline: task.bidDeadline,
        isExpired,
        bidCount: bids.length,
        bids: bids.map(bid => ({
          id: bid.id,
          price: bid.price,
          proposal: bid.proposal,
          estimatedTime: bid.estimatedTime,
          worker: bid.worker,
          createdAt: bid.createdAt
        }))
      }
    });
  } catch (error) {
    console.error('获取竞价状态失败:', error);
    res.status(500).json({ success: false, error: '获取竞价状态失败' });
  }
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

// 关闭任务接口
app.post('/api/tasks/:id/close', authenticate, async (req, res) => {
  try {
    const taskId = parseInt(req.params.id);
    const task = await prisma.task.findFirst({
      where: { id: taskId },
      include: { bids: true }
    });
    
    if (!task) {
      return res.status(404).json({ success: false, error: '任务不存在' });
    }
    
    if (task.publisherId !== req.user.id) {
      return res.status(403).json({ success: false, error: '只有任务发布者可以关闭任务' });
    }
    
    if (task.status !== 'OPEN') {
      return res.status(400).json({ success: false, error: '只有开放状态的任务可以关闭' });
    }
    
    if (task.bidDeadline && new Date() > new Date(task.bidDeadline)) {
      return res.status(400).json({ success: false, error: '竞价已截止，无法关闭任务' });
    }
    
    const hasAcceptedBid = task.bids.some(bid => bid.status === 'ACCEPTED');
    if (hasAcceptedBid) {
      return res.status(400).json({ success: false, error: '已有投标被接受，无法关闭任务' });
    }
    
    await prisma.task.update({
      where: { id: taskId },
      data: { status: 'CLOSED' }
    });
    
    res.json({ success: true, message: '任务已成功关闭' });
  } catch (error) {
    console.error('关闭任务失败:', error);
    res.status(500).json({ success: false, error: '关闭任务失败', message: error.message });
  }
});

app.post('/api/tasks', authenticate, requireBoundAgent, async (req, res) => {
  try {
    const { 
      title, 
      description, 
      category, 
      rewardPoints, 
      deadline, 
      bidDeadline,
      skills,
      acceptanceCriteria,
      attachments
    } = req.body;
    
    // 验证必填字段
    if (!title || !description || !category || !rewardPoints || !deadline) {
      return res.status(400).json({ success: false, error: '缺少必填字段' });
    }
    
    // 验证竞价截止时间
    const bidDeadlineTime = bidDeadline ? new Date(bidDeadline) : new Date(Date.now() + 3 * 24 * 60 * 60 * 1000); // 默认3天后
    const deadlineTime = new Date(deadline);
    
    if (bidDeadlineTime <= new Date()) {
      return res.status(400).json({ success: false, error: '竞价截止时间必须晚于当前时间' });
    }
    
    if (deadlineTime <= bidDeadlineTime) {
      return res.status(400).json({ success: false, error: '任务交付截止时间必须晚于竞价截止时间' });
    }
    
    // 使用 connect 建立关系
    const task = await prisma.task.create({
      data: {
        title,
        description,
        category,
        rewardPoints: parseInt(rewardPoints),
        deadline: deadlineTime,
        bidDeadline: bidDeadlineTime,
        skills: JSON.stringify(skills || []),
        acceptanceCriteria: acceptanceCriteria || null,
        attachments: JSON.stringify(attachments || []),
        publisher: { connect: { id: req.user.id } },
        status: 'OPEN'
      }
    });

    // 触发任务创建事件
    triggerEvent('task.created', {
      taskId: task.id,
      title: task.title,
      publisherId: task.publisherId,
      status: task.status,
      rewardPoints: task.rewardPoints,
      bidDeadline: task.bidDeadline,
      deadline: task.deadline
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

app.post('/api/tasks/:id/bid', authenticate, requireBoundAgent, async (req, res) => {
  const taskId = parseInt(req.params.id);
  const { price, proposal, estimatedTime } = req.body;

  const task = await prisma.task.findFirst({ where: { id: taskId } });
  if (!task) {
    return res.status(404).json({ error: '任务不存在' });
  }
  
  // 检查竞价是否已截止
  if (task.bidDeadline && new Date() > task.bidDeadline) {
    return res.status(400).json({ error: '竞价已截止' });
  }
  
  if (task.status !== 'OPEN') {
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

  // 触发新投标事件
  triggerEvent('bid.created', {
    bidId: bid.id,
    taskId,
    taskTitle: task.title,
    workerId: req.user.id,
    price: bid.price,
    proposal: bid.proposal
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

  // 触发中标事件
  triggerEvent('bid.accepted', {
    bidId,
    taskId,
    taskTitle: task.title,
    workerId: bid.workerId,
    employerId: task.publisherId,
    price: bid.price,
    contractId: contract.id
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

      // 触发工作交付事件
      triggerEvent('contract.work_submitted', {
        contractId,
        taskId: contract.taskId,
        workerId: contract.workerId,
        employerId: contract.employerId,
        deliverableId: deliverable.id
      });
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

      // 触发请求修改事件
      triggerEvent('contract.revision_requested', {
        contractId,
        taskId: contract.taskId,
        workerId: contract.workerId,
        employerId: contract.employerId,
        feedback
      });
      break;

    case 'APPROVE':
    case 'RELEASE_ESCROW':
      if (!isEmployer) {
        return res.status(403).json({ error: '只有发布者可以批准' });
      }

      // 获取任务信息
      const task = await prisma.task.findUnique({
        where: { id: contract.taskId }
      });
      
      if (!task) {
        return res.status(404).json({ error: '任务不存在' });
      }

      // 获取审核信息
      const qualityScore = parseInt(review?.qualityScore || 5); // 0-5分
      const comment = review?.comment || null;
      
      // 计算积分比例：0-5分对应 0%, 20%, 40%, 60%, 80%, 100%
      const rewardRatios = [0, 0.2, 0.4, 0.6, 0.8, 1.0];
      const rewardRatio = rewardRatios[Math.min(qualityScore, 5)];
      const actualReward = Math.floor(task.rewardPoints * rewardRatio);
      const refundAmount = task.rewardPoints - actualReward;

      // 1. 更新合同状态
      await prisma.contract.update({
        where: { id: contractId },
        data: { status: 'COMPLETED', completedAt: new Date() }
      });

      // 2. 更新任务状态
      const updatedTask = await prisma.task.update({
        where: { id: contract.taskId },
        data: { status: 'COMPLETED' },
        include: { publisher: true }
      });

      // 3. 积分转账（从发布者转到工作者，按比例）
      if (actualReward > 0) {
        await prisma.user.update({
          where: { id: contract.employerId },
          data: { points: { decrement: actualReward } }
        });

        await prisma.user.update({
          where: { id: contract.workerId },
          data: { 
            points: { increment: actualReward },
            totalPointsEarned: { increment: actualReward }
          }
        });

        // 记录积分交易记录
        await prisma.pointTransaction.create({
          data: {
            userId: contract.workerId,
            type: 'TASK_REWARD',
            amount: actualReward,
            balanceAfter: (await prisma.user.findUnique({ where: { id: contract.workerId } })).points,
            description: `完成任务 #${task.id} 获得 ${actualReward} 积分（完成度: ${qualityScore}/5, ${rewardRatio * 100}%）`,
            taskId: task.id
          }
        });
      }

      // 4. 返还剩余积分给雇主
      if (refundAmount > 0) {
        await prisma.pointTransaction.create({
          data: {
            userId: contract.employerId,
            type: 'TASK_REFUND',
            amount: refundAmount,
            balanceAfter: (await prisma.user.findUnique({ where: { id: contract.employerId } })).points,
            description: `任务 #${task.id} 审核完成，退还 ${refundAmount} 积分（完成度: ${qualityScore}/5, ${rewardRatio * 100}%）`,
            taskId: task.id
          }
        });
      }

      // 5. 记录完整支付记录
      await prisma.pointTransaction.create({
        data: {
          userId: contract.employerId,
          type: 'TASK_PAYMENT',
          amount: -task.rewardPoints,
          balanceAfter: (await prisma.user.findUnique({ where: { id: contract.employerId } })).points,
          description: `发布任务 #${task.id} 支付积分（原定: ${task.rewardPoints}, 实际: ${actualReward}）`,
          taskId: task.id
        }
      });

      result.payment = { 
        originalReward: task.rewardPoints,
        actualReward, 
        refundAmount,
        qualityScore,
        rewardRatio: rewardRatio * 100,
        workerId: contract.workerId 
      };

      // 6. 同步创建评价（如果有 review 参数）
      if (review) {
        const rev = await prisma.review.create({
          data: {
            taskId: contract.taskId,
            reviewerId: contract.employerId,
            revieweeId: contract.workerId,
            taskRating: review.rating || qualityScore,
            commRating: review.commRating || qualityScore,
            qualityRating: qualityScore,
            timeRating: review.timeRating || qualityScore,
            comment: comment
          }
        });
        result.reviewCreated = true;
        result.reviewId = rev.id;
      }

      // 触发审核通过事件
      triggerEvent('contract.approved', {
        contractId,
        taskId: contract.taskId,
        workerId: contract.workerId,
        employerId: contract.employerId,
        payment: result.payment
      });
      break;

    case 'REJECT':
      if (!isEmployer) {
        return res.status(403).json({ error: '只有雇主可以拒绝' });
      }
      await prisma.contract.update({
        where: { id: contractId },
        data: { status: 'CANCELLED' }
      });

      // 触发审核拒绝事件
      triggerEvent('contract.rejected', {
        contractId,
        taskId: contract.taskId,
        workerId: contract.workerId,
        employerId: contract.employerId
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

// 通知 API
app.get('/api/notifications', authenticate, async (req, res) => {
  try {
    const { unreadOnly = false, page = 1, limit = 20 } = req.query;
    const where = { userId: req.user.id };
    
    if (unreadOnly === 'true' || unreadOnly === true) {
      where.isRead = false;
    }

    const notifications = await prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (parseInt(page) - 1) * parseInt(limit),
      take: parseInt(limit)
    });

    const unreadCount = await prisma.notification.count({
      where: { userId: req.user.id, isRead: false }
    });

    res.json({ 
      success: true, 
      data: notifications,
      unreadCount
    });
  } catch (error) {
    console.error('获取通知失败:', error);
    res.status(500).json({ success: false, error: '获取通知失败' });
  }
});

// 标记通知已读
app.put('/api/notifications/:id/read', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const notification = await prisma.notification.findUnique({
      where: { id: parseInt(id) }
    });

    if (!notification || notification.userId !== req.user.id) {
      return res.status(404).json({ success: false, error: '通知不存在' });
    }

    await prisma.notification.update({
      where: { id: parseInt(id) },
      data: { isRead: true }
    });

    res.json({ success: true });
  } catch (error) {
    console.error('标记已读失败:', error);
    res.status(500).json({ success: false, error: '标记已读失败' });
  }
});

// 标记所有通知已读
app.put('/api/notifications/read-all', authenticate, async (req, res) => {
  try {
    await prisma.notification.updateMany({
      where: { userId: req.user.id, isRead: false },
      data: { isRead: true }
    });

    res.json({ success: true });
  } catch (error) {
    console.error('标记所有已读失败:', error);
    res.status(500).json({ success: false, error: '标记所有已读失败' });
  }
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
// 排行榜路由
// ==============================
app.use('/api/ranking', rankingRouter);

// ==============================
// 管理员路由
// ==============================
app.use('/api/admin', adminRouter);

// ==============================
// Webhook 路由
// ==============================
app.use('/api/webhooks', webhookRouter);

// ==============================
// Agent 绑定路由
// ==============================
app.use('/api/agents', agentRouter);

// ==============================
// Agent 聊天路由
// ==============================
app.use('/api/agent-chat', agentChatRouter);

// ==============================
// Agent 聊天管理路由（管理员）
// ==============================
app.use('/api/admin/agent-chat', agentChatAdminRouter);

// ==============================
// Skill 文档路由
// ==============================
// 公开路由（不需要认证）
app.use('/api/skill-documents/public', skillDocumentsRouter);
// 管理路由（需要认证）
app.use('/api/skill-documents', authenticate, skillDocumentsRouter);

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
