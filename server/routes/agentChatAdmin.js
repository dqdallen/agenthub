import express from 'express';
import { verifyToken } from '../middleware/auth.js';

const router = express.Router();

// 管理员获取所有会话（需要管理员权限）
router.get('/sessions', verifyToken, async (req, res) => {
  try {
    // 验证管理员权限
    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({ success: false, message: '需要管理员权限' });
    }
    
    const { status, type, page = 1, limit = 20 } = req.query;
    
    const where = {};
    if (status) {
      where.status = status;
    }
    if (type) {
      where.sessionType = type;
    }
    
    const sessions = await req.prisma.agentChatSession.findMany({
      where,
      include: {
        task: {
          select: {
            id: true,
            title: true
          }
        },
        initiatorAgent: {
          select: {
            agentId: true,
            name: true,
            user: {
              select: {
                id: true,
                name: true,
                email: true
              }
            }
          }
        },
        receiverAgent: {
          select: {
            agentId: true,
            name: true,
            user: {
              select: {
                id: true,
                name: true,
                email: true
              }
            }
          }
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1
        },
        _count: {
          select: {
            messages: true
          }
        }
      },
      orderBy: { updatedAt: 'desc' },
      skip: (parseInt(page) - 1) * parseInt(limit),
      take: parseInt(limit)
    });
    
    const total = await req.prisma.agentChatSession.count({ where });
    
    res.json({
      success: true,
      data: sessions.map(session => ({
        id: session.id,
        sessionType: session.sessionType,
        task: session.task,
        initiator: {
          agentId: session.initiatorAgent.agentId,
          name: session.initiatorAgent.name,
          user: session.initiatorAgent.user
        },
        receiver: {
          agentId: session.receiverAgent.agentId,
          name: session.receiverAgent.name,
          user: session.receiverAgent.user
        },
        lastMessage: session.messages[0],
        messageCount: session._count.messages,
        status: session.status,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt
      })),
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('获取所有会话失败:', error);
    res.status(500).json({ success: false, message: '获取会话列表失败' });
  }
});

// 管理员获取会话详情
router.get('/sessions/:id', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({ success: false, message: '需要管理员权限' });
    }
    
    const sessionId = parseInt(req.params.id);
    
    const session = await req.prisma.agentChatSession.findUnique({
      where: { id: sessionId },
      include: {
        task: true,
        initiatorAgent: {
          select: {
            agentId: true,
            name: true,
            user: {
              select: {
                id: true,
                name: true,
                email: true
              }
            }
          }
        },
        receiverAgent: {
          select: {
            agentId: true,
            name: true,
            user: {
              select: {
                id: true,
                name: true,
                email: true
              }
            }
          }
        },
        messages: {
          orderBy: { createdAt: 'asc' },
          include: {
            senderAgent: {
              select: {
                agentId: true,
                name: true
              }
            }
          }
        }
      }
    });
    
    if (!session) {
      return res.status(404).json({ success: false, message: '会话不存在' });
    }
    
    res.json({
      success: true,
      data: {
        id: session.id,
        sessionType: session.sessionType,
        task: session.task,
        initiator: {
          agentId: session.initiatorAgent.agentId,
          name: session.initiatorAgent.name,
          user: session.initiatorAgent.user
        },
        receiver: {
          agentId: session.receiverAgent.agentId,
          name: session.receiverAgent.name,
          user: session.receiverAgent.user
        },
        messages: session.messages.map(msg => ({
          id: msg.id,
          content: msg.content,
          type: msg.type,
          sender: msg.senderAgent,
          readBy: JSON.parse(msg.readBy),
          createdAt: msg.createdAt
        })),
        status: session.status,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
        endedAt: session.endedAt
      }
    });
  } catch (error) {
    console.error('获取会话详情失败:', error);
    res.status(500).json({ success: false, message: '获取会话详情失败' });
  }
});

// 管理员归档会话
router.post('/sessions/:id/archive', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({ success: false, message: '需要管理员权限' });
    }
    
    const sessionId = parseInt(req.params.id);
    
    const session = await req.prisma.agentChatSession.update({
      where: { id: sessionId },
      data: { status: 'ARCHIVED' }
    });
    
    res.json({ success: true, message: '会话已归档', data: session });
  } catch (error) {
    console.error('归档会话失败:', error);
    res.status(500).json({ success: false, message: '归档会话失败' });
  }
});

// 管理员获取统计数据
router.get('/stats', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({ success: false, message: '需要管理员权限' });
    }
    
    const totalSessions = await req.prisma.agentChatSession.count();
    const activeSessions = await req.prisma.agentChatSession.count({ where: { status: 'ACTIVE' } });
    const endedSessions = await req.prisma.agentChatSession.count({ where: { status: 'ENDED' } });
    const taskSessions = await req.prisma.agentChatSession.count({ where: { sessionType: 'TASK' } });
    const directSessions = await req.prisma.agentChatSession.count({ where: { sessionType: 'DIRECT' } });
    const totalMessages = await req.prisma.agentChatMessage.count();
    
    // 获取今天的统计数据
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const todaySessions = await req.prisma.agentChatSession.count({
      where: {
        createdAt: { gte: today }
      }
    });
    
    const todayMessages = await req.prisma.agentChatMessage.count({
      where: {
        createdAt: { gte: today }
      }
    });
    
    res.json({
      success: true,
      data: {
        totalSessions,
        activeSessions,
        endedSessions,
        taskSessions,
        directSessions,
        totalMessages,
        todaySessions,
        todayMessages
      }
    });
  } catch (error) {
    console.error('获取统计数据失败:', error);
    res.status(500).json({ success: false, message: '获取统计数据失败' });
  }
});

export default router;