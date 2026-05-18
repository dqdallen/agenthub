#!/usr/bin/env node

import { PrismaClient } from '@prisma/client';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'agenthub-dev-secret-123';

const server = new Server(
  {
    name: 'agenthub',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Auth helper
async function getAuthContext(arguments) {
  let authContext = null;
  
  if (arguments._api_key) {
    const apiKey = await prisma.apiKey.findFirst({
      where: { key: arguments._api_key, status: 'ACTIVE' }
    });
    if (apiKey) {
      authContext = { userId: apiKey.userId, isAgent: true };
    }
  }

  if (arguments._token) {
    try {
      const decoded = jwt.verify(arguments._token, JWT_SECRET);
      authContext = { userId: decoded.id, isAgent: false };
    } catch (e) {
    }
  }

  return authContext;
}

// Clean up args
function cleanArgs(args) {
  const cleaned = { ...args };
  delete cleaned._api_key;
  delete cleaned._token;
  return cleaned;
}

// List tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'list_tasks',
        description: '获取可投标的任务列表。支持按分类、预算范围、关键词筛选。',
        inputSchema: {
          type: 'object',
          properties: {
            category: {
              type: 'string',
              description: '任务分类',
              enum: ['DEVELOPMENT', 'DESIGN', 'CONTENT', 'DATA', 'OTHER']
            },
            status: {
              type: 'string',
              description: '任务状态',
              enum: ['OPEN', 'IN_PROGRESS', 'PENDING_REVIEW', 'COMPLETED']
            },
            search: {
              type: 'string',
              description: '关键词搜索任务标题或描述'
            },
            min_budget: {
              type: 'number',
              description: '最低预算 (元)'
            },
            max_budget: {
              type: 'number',
              description: '最高预算 (元)'
            },
            sort: {
              type: 'string',
              description: '排序方式',
              enum: ['newest', 'budget', 'deadline']
            },
            limit: {
              type: 'integer',
              description: '返回数量限制',
              default: 20
            },
            _api_key: { type: 'string', description: 'API Key（可选）' },
            _token: { type: 'string', description: 'JWT Token（可选）' }
          }
        }
      },
      {
        name: 'get_task_detail',
        description: '获取任务详情，包括描述、要求、雇主信息、当前投标列表等。',
        inputSchema: {
          type: 'object',
          properties: {
            task_id: { type: 'integer', description: '任务 ID' },
            _api_key: { type: 'string', description: 'API Key（可选）' },
            _token: { type: 'string', description: 'JWT Token（可选）' }
          },
          required: ['task_id']
        }
      },
      {
        name: 'submit_bid',
        description: '向任务提交投标。需要指定报价和提案说明。报价必须在任务预算范围内。',
        inputSchema: {
          type: 'object',
          properties: {
            task_id: { type: 'integer', description: '任务 ID' },
            price: { type: 'number', description: '投标报价 (元)' },
            proposal: { type: 'string', description: '提案说明' },
            _api_key: { type: 'string', description: 'API Key（必需）' },
            _token: { type: 'string', description: 'JWT Token（可选）' }
          },
          required: ['task_id', 'price', 'proposal']
        }
      },
      {
        name: 'check_my_bids',
        description: '查看自己提交的所有投标及其状态（待审核/已接受/已拒绝）',
        inputSchema: {
          type: 'object',
          properties: {
            _api_key: { type: 'string', description: 'API Key（必需）' },
            _token: { type: 'string', description: 'JWT Token（可选）' }
          }
        }
      },
      {
        name: 'get_my_tasks',
        description: '获取与我相关的任务列表',
        inputSchema: {
          type: 'object',
          properties: {
            type: {
              type: 'string',
              description: '任务类型',
              enum: ['published', 'assigned', 'completed', 'all'],
              default: 'all'
            },
            _api_key: { type: 'string', description: 'API Key（必需）' },
            _token: { type: 'string', description: 'JWT Token（可选）' }
          }
        }
      },
      {
        name: 'publish_task',
        description: '发布新任务。作为雇主创建任务。',
        inputSchema: {
          type: 'object',
          properties: {
            title: { type: 'string', description: '任务标题' },
            description: { type: 'string', description: '任务详细描述' },
            category: {
              type: 'string',
              description: '任务分类',
              enum: ['DEVELOPMENT', 'DESIGN', 'CONTENT', 'DATA', 'OTHER']
            },
            budget_min: { type: 'number', description: '最低预算' },
            budget_max: { type: 'number', description: '最高预算' },
            deadline: { type: 'string', description: '截止时间，ISO 8601 格式' },
            skills: { type: 'array', items: { type: 'string' }, description: '需要的技能标签' },
            _api_key: { type: 'string', description: 'API Key（必需）' },
            _token: { type: 'string', description: 'JWT Token（可选）' }
          },
          required: ['title', 'description', 'category', 'budget_min', 'budget_max', 'deadline']
        }
      },
      {
        name: 'pay_task',
        description: '为任务付款托管。资金将冻结在平台，任务完成后由雇主确认释放给工作者。',
        inputSchema: {
          type: 'object',
          properties: {
            task_id: { type: 'integer', description: '任务 ID' },
            amount: { type: 'number', description: '托管金额' },
            _api_key: { type: 'string', description: 'API Key（必需）' },
            _token: { type: 'string', description: 'JWT Token（可选）' }
          },
          required: ['task_id', 'amount']
        }
      },
      {
        name: 'select_worker',
        description: '雇主选择中标者。选中后任务状态变为进行中。',
        inputSchema: {
          type: 'object',
          properties: {
            task_id: { type: 'integer', description: '任务 ID' },
            bid_id: { type: 'integer', description: '要接受的投标 ID' },
            _api_key: { type: 'string', description: 'API Key（必需）' },
            _token: { type: 'string', description: 'JWT Token（可选）' }
          },
          required: ['task_id', 'bid_id']
        }
      },
      {
        name: 'submit_deliverable',
        description: '工作者提交任务交付物。提交后等待雇主验收。',
        inputSchema: {
          type: 'object',
          properties: {
            task_id: { type: 'integer', description: '任务 ID' },
            deliverables: { type: 'array', items: { type: 'string' }, description: '交付物列表' },
            notes: { type: 'string', description: '额外说明' },
            _api_key: { type: 'string', description: 'API Key（必需）' },
            _token: { type: 'string', description: 'JWT Token（可选）' }
          },
          required: ['task_id', 'deliverables']
        }
      },
      {
        name: 'release_funds',
        description: '雇主验收通过后释放资金。资金会分成两部分：平台服务费(10%)和工作者收入。',
        inputSchema: {
          type: 'object',
          properties: {
            task_id: { type: 'integer', description: '任务 ID' },
            _api_key: { type: 'string', description: 'API Key（必需）' },
            _token: { type: 'string', description: 'JWT Token（可选）' }
          },
          required: ['task_id']
        }
      },
      {
        name: 'partial_refund',
        description: '雇主对交付不满意时申请部分退款。需说明原因。',
        inputSchema: {
          type: 'object',
          properties: {
            task_id: { type: 'integer', description: '任务 ID' },
            refund_amount: { type: 'number', description: '退款金额' },
            reason: { type: 'string', description: '退款原因' },
            _api_key: { type: 'string', description: 'API Key（必需）' },
            _token: { type: 'string', description: 'JWT Token（可选）' }
          },
          required: ['task_id', 'refund_amount', 'reason']
        }
      },
      {
        name: 'get_balance',
        description: '查询当前账户余额和总收入',
        inputSchema: {
          type: 'object',
          properties: {
            _api_key: { type: 'string', description: 'API Key（必需）' },
            _token: { type: 'string', description: 'JWT Token（可选）' }
          }
        }
      },
      {
        name: 'withdraw',
        description: '申请提现。',
        inputSchema: {
          type: 'object',
          properties: {
            amount: { type: 'number', description: '提现金额' },
            method: {
              type: 'string',
              description: '提现方式',
              enum: ['alipay', 'bank', 'wechat'],
              default: 'alipay'
            },
            _api_key: { type: 'string', description: 'API Key（必需）' },
            _token: { type: 'string', description: 'JWT Token（可选）' }
          },
          required: ['amount']
        }
      },
      {
        name: 'create_api_key',
        description: '创建新的 API Key，用于 Agent 访问。',
        inputSchema: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Key 名称', default: 'Agent' },
            _api_key: { type: 'string', description: 'API Key（可选）' },
            _token: { type: 'string', description: 'JWT Token（必需）' }
          }
        }
      },
      {
        name: 'login',
        description: '用户登录获取 JWT Token',
        inputSchema: {
          type: 'object',
          properties: {
            email: { type: 'string', description: '邮箱地址' },
            password: { type: 'string', description: '密码' }
          },
          required: ['email', 'password']
        }
      },
      {
        name: 'register',
        description: '用户注册新账号',
        inputSchema: {
          type: 'object',
          properties: {
            email: { type: 'string', description: '邮箱地址' },
            password: { type: 'string', description: '密码' },
            name: { type: 'string', description: '用户名' },
            role: { type: 'string', enum: ['EMPLOYER', 'WORKER'], description: '角色', default: 'WORKER' }
          },
          required: ['email', 'password', 'name']
        }
      }
    ]
  };
});

// Call tool handler
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  
  try {
    switch (name) {
      case 'list_tasks': {
        const { category, status, search, min_budget, max_budget, sort, limit = 20 } = args;
        const where = {};
        if (category) where.category = category;
        if (status) where.status = status;
        if (search) where.OR = [
          { title: { contains: search } },
          { description: { contains: search } }
        ];
        if (min_budget) where.budgetMin = { gte: Number(min_budget) };
        if (max_budget) where.budgetMax = { lte: Number(max_budget) };

        const tasks = await prisma.task.findMany({
          where,
          include: { employer: { select: { id: true, name: true, rating: true } }, bids: true },
          orderBy: sort === 'newest' ? { createdAt: 'desc' } : sort === 'budget' ? { budgetMax: 'desc' } : {},
          take: Number(limit),
        });

        return {
          content: [{ type: 'text', text: JSON.stringify({ success: true, data: tasks }, null, 2) }]
        };
      }

      case 'get_task_detail': {
        const { task_id } = args;
        const task = await prisma.task.findFirst({
          where: { id: Number(task_id) },
          include: {
            employer: { select: { id: true, name: true, rating: true } },
            worker: { select: { id: true, name: true, rating: true } },
            bids: { include: { worker: { select: { id: true, name: true, rating: true } } } },
            escrows: true
          }
        });

        return {
          content: [{ type: 'text', text: JSON.stringify({ success: true, data: task }, null, 2) }]
        };
      }

      case 'submit_bid': {
        const authContext = await getAuthContext(args);
        if (!authContext) {
          return {
            content: [{ type: 'text', text: JSON.stringify({ error: '需要认证' }, null, 2) }],
            isError: true
          };
        }
        const clean = cleanArgs(args);
        const { task_id, price, proposal } = clean;

        const task = await prisma.task.findFirst({ where: { id: Number(task_id) } });
        if (!task || task.status !== 'OPEN') {
          return {
            content: [{ type: 'text', text: JSON.stringify({ error: '任务不可投标' }, null, 2) }],
            isError: true
          };
        }

        const existingBid = await prisma.bid.findFirst({
          where: { taskId: Number(task_id), workerId: authContext.userId }
        });
        if (existingBid) {
          return {
            content: [{ type: 'text', text: JSON.stringify({ error: '您已经投过标了' }, null, 2) }],
            isError: true
          };
        }

        const bid = await prisma.bid.create({
          data: {
            price: Number(price),
            proposal,
            taskId: Number(task_id),
            workerId: authContext.userId,
            status: 'PENDING'
          }
        });

        await prisma.task.update({
          where: { id: Number(task_id) },
          data: { bidCount: { increment: 1 } }
        });

        return {
          content: [{ type: 'text', text: JSON.stringify({ success: true, data: bid }, null, 2) }]
        };
      }

      case 'check_my_bids': {
        const authContext = await getAuthContext(args);
        if (!authContext) {
          return {
            content: [{ type: 'text', text: JSON.stringify({ error: '需要认证' }, null, 2) }],
            isError: true
          };
        }

        const bids = await prisma.bid.findMany({
          where: { workerId: authContext.userId },
          include: { task: { select: { id: true, title: true, status: true } } }
        });

        return {
          content: [{ type: 'text', text: JSON.stringify({ success: true, data: bids }, null, 2) }]
        };
      }

      case 'get_my_tasks': {
        const authContext = await getAuthContext(args);
        if (!authContext) {
          return {
            content: [{ type: 'text', text: JSON.stringify({ error: '需要认证' }, null, 2) }],
            isError: true
          };
        }
        const clean = cleanArgs(args);
        const { type = 'all' } = clean;
        const userId = authContext.userId;

        let tasks;
        if (type === 'published') {
          tasks = await prisma.task.findMany({
            where: { employerId: userId },
            include: { bids: true }
          });
        } else if (type === 'assigned') {
          tasks = await prisma.task.findMany({
            where: { workerId: userId, status: { in: ['IN_PROGRESS', 'PENDING_REVIEW'] } },
            include: { employer: true }
          });
        } else if (type === 'completed') {
          tasks = await prisma.task.findMany({
            where: { OR: [{ employerId: userId }, { workerId: userId }], status: 'COMPLETED' },
            include: { employer: true, worker: true }
          });
        } else {
          tasks = await prisma.task.findMany({
            where: { OR: [{ employerId: userId }, { workerId: userId }] },
            include: { employer: true, worker: true, bids: true }
          });
        }

        return {
          content: [{ type: 'text', text: JSON.stringify({ success: true, data: tasks }, null, 2) }]
        };
      }

      case 'publish_task': {
        const authContext = await getAuthContext(args);
        if (!authContext) {
          return {
            content: [{ type: 'text', text: JSON.stringify({ error: '需要认证' }, null, 2) }],
            isError: true
          };
        }
        const clean = cleanArgs(args);
        const { title, description, category, budget_min, budget_max, deadline, skills = [] } = clean;

        const task = await prisma.task.create({
          data: {
            title,
            description,
            category,
            budgetMin: Number(budget_min),
            budgetMax: Number(budget_max),
            deadline: new Date(deadline),
            skills: JSON.stringify(skills),
            employerId: authContext.userId,
            status: 'OPEN'
          }
        });

        return {
          content: [{ type: 'text', text: JSON.stringify({ success: true, data: task }, null, 2) }]
        };
      }

      case 'pay_task': {
        const authContext = await getAuthContext(args);
        if (!authContext) {
          return {
            content: [{ type: 'text', text: JSON.stringify({ error: '需要认证' }, null, 2) }],
            isError: true
          };
        }
        const clean = cleanArgs(args);
        const { task_id, amount } = clean;

        const task = await prisma.task.findFirst({ where: { id: Number(task_id) } });
        if (!task || task.employerId !== authContext.userId) {
          return {
            content: [{ type: 'text', text: JSON.stringify({ error: '无权操作' }, null, 2) }],
            isError: true
          };
        }

        const escrow = await prisma.escrow.create({
          data: {
            taskId: Number(task_id),
            amount: Number(amount),
            status: 'HELD'
          }
        });

        return {
          content: [{ type: 'text', text: JSON.stringify({ success: true, data: escrow }, null, 2) }]
        };
      }

      case 'select_worker': {
        const authContext = await getAuthContext(args);
        if (!authContext) {
          return {
            content: [{ type: 'text', text: JSON.stringify({ error: '需要认证' }, null, 2) }],
            isError: true
          };
        }
        const clean = cleanArgs(args);
        const { task_id, bid_id } = clean;

        const task = await prisma.task.findFirst({ where: { id: Number(task_id) } });
        if (!task || task.employerId !== authContext.userId) {
          return {
            content: [{ type: 'text', text: JSON.stringify({ error: '无权操作' }, null, 2) }],
            isError: true
          };
        }

        const bid = await prisma.bid.findFirst({ where: { id: Number(bid_id), taskId: Number(task_id) } });
        if (!bid) {
          return {
            content: [{ type: 'text', text: JSON.stringify({ error: '投标不存在' }, null, 2) }],
            isError: true
          };
        }

        await prisma.bid.update({
          where: { id: bid.id },
          data: { status: 'ACCEPTED' }
        });

        await prisma.task.update({
          where: { id: Number(task_id) },
          data: { workerId: bid.workerId, status: 'IN_PROGRESS', finalPrice: bid.price }
        });

        return {
          content: [{ type: 'text', text: JSON.stringify({ success: true, data: { task_id, workerId: bid.workerId, price: bid.price } }, null, 2) }]
        };
      }

      case 'submit_deliverable': {
        const authContext = await getAuthContext(args);
        if (!authContext) {
          return {
            content: [{ type: 'text', text: JSON.stringify({ error: '需要认证' }, null, 2) }],
            isError: true
          };
        }
        const clean = cleanArgs(args);
        const { task_id, deliverables, notes = '' } = clean;

        const task = await prisma.task.findFirst({ where: { id: Number(task_id) } });
        if (!task || task.workerId !== authContext.userId) {
          return {
            content: [{ type: 'text', text: JSON.stringify({ error: '无权操作' }, null, 2) }],
            isError: true
          };
        }

        await prisma.task.update({
          where: { id: task.id },
          data: {
            status: 'PENDING_REVIEW',
            attachments: JSON.stringify(deliverables)
          }
        });

        return {
          content: [{ type: 'text', text: JSON.stringify({ success: true, data: { deliverables, notes } }, null, 2) }]
        };
      }

      case 'release_funds': {
        const authContext = await getAuthContext(args);
        if (!authContext) {
          return {
            content: [{ type: 'text', text: JSON.stringify({ error: '需要认证' }, null, 2) }],
            isError: true
          };
        }
        const clean = cleanArgs(args);
        const { task_id } = clean;

        const task = await prisma.task.findFirst({
          where: { id: Number(task_id) },
          include: { escrows: true }
        });

        if (!task || task.employerId !== authContext.userId) {
          return {
            content: [{ type: 'text', text: JSON.stringify({ error: '无权操作' }, null, 2) }],
            isError: true
          };
        }

        const escrow = task.escrows.find(e => e.status === 'HELD');
        if (!escrow) {
          return {
            content: [{ type: 'text', text: JSON.stringify({ error: '没有可释放的托管资金' }, null, 2) }],
            isError: true
          };
        }

        const platformFee = escrow.amount * 0.1;
        const workerAmount = escrow.amount - platformFee;

        await prisma.escrow.update({
          where: { id: escrow.id },
          data: { status: 'RELEASED', releasedAt: new Date() }
        });

        await prisma.user.update({
          where: { id: task.workerId },
          data: {
            balance: { increment: workerAmount },
            totalEarnings: { increment: workerAmount }
          }
        });

        await prisma.task.update({
          where: { id: task.id },
          data: { status: 'COMPLETED' }
        });

        return {
          content: [{ type: 'text', text: JSON.stringify({ success: true, data: { total: escrow.amount, platformFee, workerAmount } }, null, 2) }]
        };
      }

      case 'partial_refund': {
        const authContext = await getAuthContext(args);
        if (!authContext) {
          return {
            content: [{ type: 'text', text: JSON.stringify({ error: '需要认证' }, null, 2) }],
            isError: true
          };
        }
        const clean = cleanArgs(args);
        const { task_id, refund_amount, reason } = clean;

        const task = await prisma.task.findFirst({
          where: { id: Number(task_id) },
          include: { escrows: true }
        });

        if (!task || task.employerId !== authContext.userId) {
          return {
            content: [{ type: 'text', text: JSON.stringify({ error: '无权操作' }, null, 2) }],
            isError: true
          };
        }

        const escrow = task.escrows.find(e => e.status === 'HELD');
        if (!escrow) {
          return {
            content: [{ type: 'text', text: JSON.stringify({ error: '没有托管资金' }, null, 2) }],
            isError: true
          };
        }

        const workerAmount = escrow.amount - refund_amount - (escrow.amount * 0.05);

        await prisma.escrow.update({
          where: { id: escrow.id },
          data: { status: 'RELEASED', releasedAt: new Date() }
        });

        await prisma.user.update({
          where: { id: task.workerId },
          data: { balance: { increment: workerAmount } }
        });

        return {
          content: [{ type: 'text', text: JSON.stringify({
            success: true,
            data: {
              totalEscrow: escrow.amount,
              refundToEmployer: refund_amount,
              platformFee: escrow.amount * 0.05,
              paidToWorker: workerAmount,
              reason
            }
          }, null, 2) }]
        };
      }

      case 'get_balance': {
        const authContext = await getAuthContext(args);
        if (!authContext) {
          return {
            content: [{ type: 'text', text: JSON.stringify({ error: '需要认证' }, null, 2) }],
            isError: true
          };
        }

        const user = await prisma.user.findFirst({
          where: { id: authContext.userId },
          select: { balance: true, totalEarnings: true }
        });

        return {
          content: [{ type: 'text', text: JSON.stringify({ success: true, data: user }, null, 2) }]
        };
      }

      case 'withdraw': {
        const authContext = await getAuthContext(args);
        if (!authContext) {
          return {
            content: [{ type: 'text', text: JSON.stringify({ error: '需要认证' }, null, 2) }],
            isError: true
          };
        }
        const clean = cleanArgs(args);
        const { amount, method = 'alipay' } = clean;

        const user = await prisma.user.findFirst({ where: { id: authContext.userId } });
        if (!user || user.balance < amount) {
          return {
            content: [{ type: 'text', text: JSON.stringify({ error: '余额不足' }, null, 2) }],
            isError: true
          };
        }

        await prisma.user.update({
          where: { id: authContext.userId },
          data: { balance: { decrement: amount } }
        });

        return {
          content: [{ type: 'text', text: JSON.stringify({ success: true, data: { amount, method, status: 'processing' } }, null, 2) }]
        };
      }

      case 'create_api_key': {
        const authContext = await getAuthContext(args);
        if (!authContext) {
          return {
            content: [{ type: 'text', text: JSON.stringify({ error: '需要认证' }, null, 2) }],
            isError: true
          };
        }
        const clean = cleanArgs(args);
        const { name = 'Agent' } = clean;

        const crypto = await import('crypto');
        const key = 'ak_' + crypto.randomBytes(24).toString('hex');

        const apiKey = await prisma.apiKey.create({
          data: { key, name, userId: authContext.userId }
        });

        return {
          content: [{ type: 'text', text: JSON.stringify({ success: true, data: apiKey }, null, 2) }]
        };
      }

      case 'login': {
        const { email, password } = args;
        const user = await prisma.user.findFirst({ where: { email } });

        if (!user || !await bcrypt.compare(password, user.password)) {
          return {
            content: [{ type: 'text', text: JSON.stringify({ error: '密码错误' }, null, 2) }],
            isError: true
          };
        }

        const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: '7d' });
        return {
          content: [{ type: 'text', text: JSON.stringify({ success: true, data: { user: { ...user, password: undefined }, token } }, null, 2) }]
        };
      }

      case 'register': {
        const { email, password, name, role = 'WORKER' } = args;
        const hashedPassword = await bcrypt.hash(password, 10);

        try {
          const user = await prisma.user.create({
            data: { email, name, password: hashedPassword, role }
          });

          const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: '7d' });
          return {
            content: [{ type: 'text', text: JSON.stringify({ success: true, data: { user: { ...user, password: undefined }, token } }, null, 2) }]
          };
        } catch (e) {
          return {
            content: [{ type: 'text', text: JSON.stringify({ error: '邮箱已被使用' }, null, 2) }],
            isError: true
          };
        }
      }

      default:
        return {
          content: [{ type: 'text', text: JSON.stringify({ error: `Unknown tool: ${name}` }, null, 2) }],
          isError: true
        };
    }
  } catch (error) {
    console.error('Error:', error);
    return {
      content: [{ type: 'text', text: JSON.stringify({ error: error.message }, null, 2) }],
      isError: true
    };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('AgentHub MCP Server running on stdio');
}

main().catch((error) => {
  console.error('Server error:', error);
  process.exit(1);
});
