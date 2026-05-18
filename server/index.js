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
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, name, role } = req.body;
    const hashed = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        email,
        name,
        password: hashed,
        role: role || 'WORKER'
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
    select: { id: true, email: true, name: true, role: true, rating: true, balance: true, totalEarnings: true }
  });
  res.json({ success: true, data: user });
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
  const { category, status = 'OPEN', search, page = 1, limit = 20 } = req.query;
  const where = { status };
  if (category) where.category = category;
  if (search) {
    where.OR = [
      { title: { contains: search } },
      { description: { contains: search } }
    ];
  }

  const [tasks, total] = await Promise.all([
    prisma.task.findMany({
      where,
      include: {
        employer: { select: { id: true, name: true, rating: true } },
        bids: true
      },
      skip: (page - 1) * limit,
      take: parseInt(limit),
      orderBy: { createdAt: 'desc' }
    }),
    prisma.task.count({ where })
  ]);

  res.json({
    success: true,
    data: tasks,
    pagination: { page: parseInt(page), limit: parseInt(limit), total }
  });
});

app.get('/api/tasks/my', authenticate, async (req, res) => {
  const { type = 'all' } = req.query;
  let where = {};

  if (type === 'published') {
    where = { employerId: req.user.id };
  } else if (type === 'assigned') {
    where = { workerId: req.user.id };
  } else {
    where = {
      OR: [
        { employerId: req.user.id },
        { workerId: req.user.id }
      ]
    };
  }

  const tasks = await prisma.task.findMany({
    where,
    include: { employer: true, worker: true, bids: true }
  });
  res.json({ success: true, data: tasks });
});

app.get('/api/tasks/:id', async (req, res) => {
  const task = await prisma.task.findFirst({
    where: { id: parseInt(req.params.id) },
    include: {
      employer: { select: { id: true, name: true, rating: true } },
      worker: { select: { id: true, name: true, rating: true } },
      bids: { include: { worker: { select: { id: true, name: true, rating: true } } } },
      escrows: true
    }
  });
  res.json({ success: true, data: task });
});

app.post('/api/tasks', authenticate, async (req, res) => {
  const { title, description, category, budgetMin, budgetMax, deadline, skills } = req.body;
  const task = await prisma.task.create({
    data: {
      title,
      description,
      category,
      budgetMin: parseFloat(budgetMin),
      budgetMax: parseFloat(budgetMax),
      deadline: new Date(deadline),
      skills: JSON.stringify(skills || []),
      employerId: req.user.id,
      status: 'OPEN'
    }
  });
  res.json({ success: true, data: task });
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
  if (!task || task.employerId !== req.user.id) {
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
    data: { workerId: bid.workerId, status: 'IN_PROGRESS', finalPrice: bid.price }
  });

  // 3. 创建合同（类似 dealwork.ai）
  const contract = await prisma.contract.create({
    data: {
      taskId,
      bidId,
      employerId: task.employerId,
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
      createdById: task.employerId
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
        return res.status(403).json({ error: '只有雇主可以批准' });
      }

      // 1. 更新合同状态
      await prisma.contract.update({
        where: { id: contractId },
        data: { status: 'COMPLETED', completedAt: new Date() }
      });

      // 2. 更新任务状态
      await prisma.task.update({
        where: { id: contract.taskId },
        data: { status: 'COMPLETED' }
      });

      // 3. 如果有托管资金，释放（平台抽成10%）
      const escrow = await prisma.escrow.findFirst({
        where: { taskId: contract.taskId, status: 'HELD' }
      });

      if (escrow) {
        const platformFee = escrow.amount * 0.1;
        const workerAmount = escrow.amount - platformFee;

        await prisma.escrow.update({
          where: { id: escrow.id },
          data: { status: 'RELEASED', releasedAt: new Date() }
        });

        await prisma.user.update({
          where: { id: contract.workerId },
          data: {
            balance: { increment: workerAmount },
            totalEarnings: { increment: workerAmount }
          }
        });

        result.payment = { total: escrow.amount, workerAmount, platformFee };
      }

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
// 支付 API
// ===========================
app.post('/api/payments/pay-task', authenticate, async (req, res) => {
  const { taskId, amount } = req.body;

  const task = await prisma.task.findFirst({ where: { id: parseInt(taskId) } });
  if (!task || task.employerId !== req.user.id) {
    return res.status(403).json({ error: '无权操作' });
  }

  const escrow = await prisma.escrow.create({
    data: {
      taskId: parseInt(taskId),
      amount: parseFloat(amount),
      status: 'HELD'
    }
  });

  res.json({ success: true, data: escrow });
});

app.get('/api/payments/balance', authenticate, async (req, res) => {
  const user = await prisma.user.findFirst({
    where: { id: req.user.id },
    select: { id: true, balance: true, totalEarnings: true }
  });
  res.json({ success: true, data: user });
});

app.post('/api/payments/withdraw', authenticate, async (req, res) => {
  const { amount, method } = req.body;
  const user = await prisma.user.findFirst({ where: { id: req.user.id } });

  if (user.balance < parseFloat(amount)) {
    return res.status(400).json({ error: '余额不足' });
  }

  await prisma.user.update({
    where: { id: req.user.id },
    data: { balance: { decrement: parseFloat(amount) } }
  });

  res.json({
    success: true,
    data: { message: '提现申请已提交，将在 1-3 个工作日内处理', amount, method }
  });
});

app.post('/api/payments/partial-refund', authenticate, async (req, res) => {
  const { taskId, refundAmount, reason } = req.body;

  const task = await prisma.task.findFirst({
    where: { id: parseInt(taskId) },
    include: { escrows: true }
  });

  if (!task || task.employerId !== req.user.id) {
    return res.status(403).json({ error: '无权操作' });
  }

  const escrow = task.escrows.find(e => e.status === 'HELD');
  if (!escrow) {
    return res.status(400).json({ error: '没有托管资金' });
  }

  const refundAmt = parseFloat(refundAmount);
  const workerAmt = escrow.amount - refundAmt - (escrow.amount * 0.05);

  await prisma.escrow.update({
    where: { id: escrow.id },
    data: { status: 'RELEASED', releasedAt: new Date() }
  });

  await prisma.user.update({
    where: { id: task.workerId },
    data: { balance: { increment: workerAmt } }
  });

  res.json({
    success: true,
    data: {
      totalEscrow: escrow.amount,
      refundToEmployer: refundAmt,
      platformFee: escrow.amount * 0.05,
      paidToWorker: workerAmt,
      reason
    }
  });
});

// ===========================
// 评价 API
// ===========================
app.post('/api/reviews/:taskId', authenticate, async (req, res) => {
  const { taskId } = req.params;
  const task = await prisma.task.findFirst({ where: { id: parseInt(taskId) } });

  const revieweeId = task.employerId === req.user.id ? task.workerId : task.employerId;

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
