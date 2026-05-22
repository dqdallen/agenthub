import express from 'express';
import axios from 'axios';
import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';
import { verifyToken } from '../middleware/auth.js';

const prisma = new PrismaClient();
const router = express.Router();

// 支持的事件类型
const SUPPORTED_EVENTS = [
  'task.created',           // 任务创建
  'task.updated',           // 任务更新
  'task.status_changed',    // 任务状态变更
  'task.bid_deadline',      // 竞价截止
  'bid.created',            // 新投标
  'bid.accepted',           // 投标被接受（中标）
  'bid.rejected',           // 投标被拒绝
  'contract.created',       // 合同创建
  'contract.updated',       // 合同更新
  'contract.work_submitted', // 工作交付
  'contract.approved',      // 任务审核通过
  'contract.rejected',      // 任务审核拒绝
  'contract.revision_requested', // 请求修改
  'point.transaction',      // 积分变动
  'notification.created'    // 通知创建
];

// 生成签名
function generateSignature(secret, body) {
  if (!secret) return null;
  return crypto.createHmac('sha256', secret).update(JSON.stringify(body)).digest('hex');
}

// 发送 Webhook 请求
async function sendWebhook(endpoint, eventType, payload) {
  try {
    const body = {
      event: eventType,
      timestamp: Date.now(),
      data: payload
    };

    const headers = {
      'Content-Type': 'application/json',
      'X-Webhook-Event': eventType,
      'X-Webhook-Timestamp': Date.now().toString()
    };

    if (endpoint.secret) {
      headers['X-Webhook-Signature'] = generateSignature(endpoint.secret, body);
    }

    // 创建日志记录
    const log = await prisma.webhookLog.create({
      data: {
        webhookId: endpoint.id,
        eventType,
        requestBody: JSON.stringify(body),
        status: 'PENDING'
      }
    });

    // 发送请求（带超时）
    const response = await axios.post(endpoint.url, body, {
      headers,
      timeout: 10000 // 10秒超时
    });

    // 更新日志为成功
    await prisma.webhookLog.update({
      where: { id: log.id },
      data: {
        status: 'SUCCESS',
        statusCode: response.status,
        responseBody: JSON.stringify(response.data)
      }
    });

    return { success: true, statusCode: response.status };
  } catch (error) {
    // 更新日志为失败
    await prisma.webhookLog.update({
      where: { id: log?.id },
      data: {
        status: 'FAILED',
        statusCode: error.response?.status || 0,
        errorMessage: error.message,
        responseBody: error.response?.data ? JSON.stringify(error.response.data) : null
      }
    });

    // 触发重试机制
    await scheduleRetry(log?.id, endpoint);

    return { success: false, error: error.message };
  }
}

// 重试机制
async function scheduleRetry(logId, endpoint) {
  try {
    const log = await prisma.webhookLog.findUnique({
      where: { id: logId }
    });

    if (!log || log.retryCount >= 3) {
      // 超过最大重试次数，标记为最终失败
      await prisma.webhookLog.update({
        where: { id: logId },
        data: { status: 'FAILED' }
      });
      return;
    }

    // 指数退避重试：1分钟, 5分钟, 15分钟
    const delays = [60000, 300000, 900000];
    const delay = delays[log.retryCount];

    setTimeout(async () => {
      const updatedLog = await prisma.webhookLog.findUnique({
        where: { id: logId }
      });

      if (updatedLog && updatedLog.status === 'FAILED' && updatedLog.retryCount < 3) {
        // 重新发送
        await prisma.webhookLog.update({
          where: { id: logId },
          data: { retryCount: { increment: 1 }, status: 'PENDING' }
        });

        // 重新发送请求
        const body = JSON.parse(updatedLog.requestBody);
        const headers = {
          'Content-Type': 'application/json',
          'X-Webhook-Event': body.event,
          'X-Webhook-Timestamp': Date.now().toString()
        };

        if (endpoint.secret) {
          headers['X-Webhook-Signature'] = generateSignature(endpoint.secret, body);
        }

        try {
          const response = await axios.post(endpoint.url, body, { headers, timeout: 10000 });
          await prisma.webhookLog.update({
            where: { id: logId },
            data: {
              status: 'SUCCESS',
              statusCode: response.status,
              responseBody: JSON.stringify(response.data)
            }
          });
        } catch (error) {
          await scheduleRetry(logId, endpoint);
        }
      }
    }, delay);
  } catch (error) {
    console.error('Webhook retry scheduling error:', error);
  }
}

// 触发事件
export async function triggerEvent(eventType, payload) {
  try {
    // 获取所有订阅此事件的活跃 Webhook
    const endpoints = await prisma.webhookEndpoint.findMany({
      where: {
        status: 'ACTIVE'
      }
    });

    // 过滤订阅了此事件的 endpoint
    const filteredEndpoints = endpoints.filter(endpoint => {
      const subscribedEvents = JSON.parse(endpoint.subscribedEvents || '[]');
      return subscribedEvents.includes(eventType);
    });

    // 并发发送所有匹配的 Webhook
    const promises = filteredEndpoints.map(endpoint => 
      sendWebhook(endpoint, eventType, payload)
    );

    await Promise.allSettled(promises);
  } catch (error) {
    console.error('Error triggering webhook event:', error);
  }
}

// ============================================
// Webhook API 端点
// ============================================

// 创建 Webhook 端点
router.post('/', verifyToken, async (req, res) => {
  try {
    const { url, secret, description, subscribedEvents } = req.body;

    if (!url) {
      return res.status(400).json({ success: false, error: 'url 是必填项' });
    }

    // 验证订阅的事件类型
    if (subscribedEvents) {
      const invalidEvents = subscribedEvents.filter(e => !SUPPORTED_EVENTS.includes(e));
      if (invalidEvents.length > 0) {
        return res.status(400).json({
          success: false,
          error: `不支持的事件类型: ${invalidEvents.join(', ')}`
        });
      }
    }

    const webhook = await prisma.webhookEndpoint.create({
      data: {
        userId: req.user.id,
        url,
        secret: secret || '',
        description,
        subscribedEvents: JSON.stringify(subscribedEvents || SUPPORTED_EVENTS),
        status: 'ACTIVE'
      }
    });

    res.json({
      success: true,
      data: webhook
    });
  } catch (error) {
    console.error('创建 Webhook 失败:', error);
    res.status(500).json({ success: false, error: '创建失败' });
  }
});

// 获取当前用户的所有 Webhook 端点
router.get('/', verifyToken, async (req, res) => {
  try {
    const webhooks = await prisma.webhookEndpoint.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' }
    });

    res.json({
      success: true,
      data: webhooks
    });
  } catch (error) {
    console.error('获取 Webhook 列表失败:', error);
    res.status(500).json({ success: false, error: '获取失败' });
  }
});

// 获取单个 Webhook 端点
router.get('/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const webhook = await prisma.webhookEndpoint.findUnique({
      where: { id: parseInt(id) }
    });

    if (!webhook) {
      return res.status(404).json({ success: false, error: 'Webhook 不存在' });
    }

    // 验证权限
    if (webhook.userId !== req.user.id) {
      return res.status(403).json({ success: false, error: '无权访问' });
    }

    res.json({
      success: true,
      data: webhook
    });
  } catch (error) {
    console.error('获取 Webhook 失败:', error);
    res.status(500).json({ success: false, error: '获取失败' });
  }
});

// 更新 Webhook 端点
router.put('/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { url, secret, description, subscribedEvents, status } = req.body;

    const webhook = await prisma.webhookEndpoint.findUnique({
      where: { id: parseInt(id) }
    });

    if (!webhook) {
      return res.status(404).json({ success: false, error: 'Webhook 不存在' });
    }

    // 验证权限
    if (webhook.userId !== req.user.id) {
      return res.status(403).json({ success: false, error: '无权修改' });
    }

    // 验证订阅的事件类型
    if (subscribedEvents) {
      const invalidEvents = subscribedEvents.filter(e => !SUPPORTED_EVENTS.includes(e));
      if (invalidEvents.length > 0) {
        return res.status(400).json({
          success: false,
          error: `不支持的事件类型: ${invalidEvents.join(', ')}`
        });
      }
    }

    const updated = await prisma.webhookEndpoint.update({
      where: { id: parseInt(id) },
      data: {
        ...(url && { url }),
        ...(secret !== undefined && { secret }),
        ...(description && { description }),
        ...(subscribedEvents && { subscribedEvents: JSON.stringify(subscribedEvents) }),
        ...(status && { status })
      }
    });

    res.json({
      success: true,
      data: updated
    });
  } catch (error) {
    console.error('更新 Webhook 失败:', error);
    res.status(500).json({ success: false, error: '更新失败' });
  }
});

// 删除 Webhook 端点
router.delete('/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const webhook = await prisma.webhookEndpoint.findUnique({
      where: { id: parseInt(id) }
    });

    if (!webhook) {
      return res.status(404).json({ success: false, error: 'Webhook 不存在' });
    }

    // 验证权限
    if (webhook.userId !== req.user.id) {
      return res.status(403).json({ success: false, error: '无权删除' });
    }

    await prisma.webhookEndpoint.delete({
      where: { id: parseInt(id) }
    });

    res.json({
      success: true,
      message: 'Webhook 已删除'
    });
  } catch (error) {
    console.error('删除 Webhook 失败:', error);
    res.status(500).json({ success: false, error: '删除失败' });
  }
});

// 获取 Webhook 日志
router.get('/:id/logs', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 20 } = req.query;

    const webhook = await prisma.webhookEndpoint.findUnique({
      where: { id: parseInt(id) }
    });

    if (!webhook) {
      return res.status(404).json({ success: false, error: 'Webhook 不存在' });
    }

    // 验证权限
    if (webhook.userId !== req.user.id) {
      return res.status(403).json({ success: false, error: '无权访问' });
    }

    const logs = await prisma.webhookLog.findMany({
      where: { webhookId: parseInt(id) },
      orderBy: { createdAt: 'desc' },
      skip: (parseInt(page) - 1) * parseInt(limit),
      take: parseInt(limit)
    });

    const total = await prisma.webhookLog.count({
      where: { webhookId: parseInt(id) }
    });

    res.json({
      success: true,
      data: logs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('获取 Webhook 日志失败:', error);
    res.status(500).json({ success: false, error: '获取失败' });
  }
});

// 测试 Webhook 端点
router.post('/:id/test', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const webhook = await prisma.webhookEndpoint.findUnique({
      where: { id: parseInt(id) }
    });

    if (!webhook) {
      return res.status(404).json({ success: false, error: 'Webhook 不存在' });
    }

    // 验证权限
    if (webhook.userId !== req.user.id) {
      return res.status(403).json({ success: false, error: '无权访问' });
    }

    // 发送测试事件
    const testPayload = {
      test: true,
      message: '这是一个测试事件',
      timestamp: Date.now()
    };

    const result = await sendWebhook(webhook, 'webhook.test', testPayload);

    res.json({
      success: result.success,
      message: result.success ? '测试发送成功' : `测试发送失败: ${result.error}`
    });
  } catch (error) {
    console.error('测试 Webhook 失败:', error);
    res.status(500).json({ success: false, error: '测试失败' });
  }
});

// 获取支持的事件类型列表
router.get('/events/list', (req, res) => {
  res.json({
    success: true,
    data: SUPPORTED_EVENTS,
    descriptions: {
      'task.created': '任务创建',
      'task.updated': '任务更新',
      'task.status_changed': '任务状态变更',
      'task.bid_deadline': '竞价截止',
      'bid.created': '新投标',
      'bid.accepted': '投标被接受（中标）',
      'bid.rejected': '投标被拒绝',
      'contract.created': '合同创建',
      'contract.updated': '合同更新',
      'contract.work_submitted': '工作交付',
      'contract.approved': '任务审核通过',
      'contract.rejected': '任务审核拒绝',
      'contract.revision_requested': '请求修改',
      'point.transaction': '积分变动',
      'notification.created': '通知创建',
      'webhook.test': '测试事件'
    }
  });
});

export default router;
export { SUPPORTED_EVENTS };
