import express from 'express';
import { verifyToken } from '../middleware/auth.js';

const router = express.Router();

// 获取当前 Agent 的所有会话
router.get('/sessions', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // 获取用户的所有 Agent
    const agents = await req.prisma.agent.findMany({
      where: { userId, status: 'BOUND' }
    });
    
    if (agents.length === 0) {
      return res.json({ success: true, data: [] });
    }
    
    const agentIds = agents.map(a => a.agentId);
    
    // 获取这些 Agent 参与的所有会话
    const sessions = await req.prisma.agentChatSession.findMany({
      where: {
        OR: [
          { initiatorAgentId: { in: agentIds } },
          { receiverAgentId: { in: agentIds } }
        ],
        status: { in: ['ACTIVE', 'ENDED'] }
      },
      include: {
        task: {
          select: {
            id: true,
            title: true
          }
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      },
      orderBy: { updatedAt: 'desc' }
    });
    
    // 格式化返回数据
    const formattedSessions = sessions.map(session => {
      const isInitiator = session.initiatorAgentId === agentIds[0];
      const otherAgentId = isInitiator ? session.receiverAgentId : session.initiatorAgentId;
      const otherAgent = agents.find(a => a.agentId === otherAgentId);
      
      return {
        id: session.id,
        sessionType: session.sessionType,
        task: session.task,
        otherAgent: otherAgent ? {
          agentId: otherAgent.agentId,
          name: otherAgent.name,
          displayName: otherAgent.displayName || otherAgent.name
        } : null,
        lastMessage: session.messages[0] || null,
        status: session.status,
        isInitiator,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt
      };
    });
    
    res.json({ success: true, data: formattedSessions });
  } catch (error) {
    console.error('获取会话列表失败:', error);
    res.status(500).json({ success: false, message: '获取会话列表失败' });
  }
});

// 获取会话详情和消息
router.get('/sessions/:id', verifyToken, async (req, res) => {
  try {
    const sessionId = parseInt(req.params.id);
    const userId = req.user.id;
    
    // 验证用户是否拥有这个会话中的 Agent
    const agents = await req.prisma.agent.findMany({
      where: { userId, status: 'BOUND' }
    });
    
    const agentIds = agents.map(a => a.agentId);
    
    const session = await req.prisma.agentChatSession.findFirst({
      where: {
        id: sessionId,
        OR: [
          { initiatorAgentId: { in: agentIds } },
          { receiverAgentId: { in: agentIds } }
        ]
      },
      include: {
        task: true,
        messages: {
          orderBy: { createdAt: 'asc' }
        }
      }
    });
    
    if (!session) {
      return res.status(404).json({ success: false, message: '会话不存在' });
    }
    
    // 标记消息已读
    const currentAgentId = agents[0]?.agentId;
    if (currentAgentId) {
      for (const msg of session.messages) {
        if (msg.senderAgentId !== currentAgentId) {
          let readBy = JSON.parse(msg.readBy);
          if (!readBy.includes(currentAgentId)) {
            readBy.push(currentAgentId);
            await req.prisma.agentChatMessage.update({
              where: { id: msg.id },
              data: { readBy: JSON.stringify(readBy) }
            });
          }
        }
      }
    }
    
    // 获取其他 Agent 信息
    const otherAgentId = agentIds.includes(session.initiatorAgentId) 
      ? session.receiverAgentId 
      : session.initiatorAgentId;
    const otherAgent = agents.find(a => a.agentId === otherAgentId);
    
    res.json({
      success: true,
      data: {
        ...session,
        otherAgent: otherAgent ? {
          agentId: otherAgent.agentId,
          name: otherAgent.name,
          displayName: otherAgent.displayName || otherAgent.name
        } : { agentId: otherAgentId, name: '未知Agent' },
        isInitiator: session.initiatorAgentId === agents[0]?.agentId
      }
    });
  } catch (error) {
    console.error('获取会话详情失败:', error);
    res.status(500).json({ success: false, message: '获取会话详情失败' });
  }
});

// Agent 主动发起直接聊天（对外发起）
router.post('/sessions/direct', verifyToken, async (req, res) => {
  try {
    const { receiverAgentId } = req.body;
    const userId = req.user.id;
    
    if (!receiverAgentId) {
      return res.status(400).json({ success: false, message: '接收者 Agent ID 不能为空' });
    }
    
    // 获取发送者的 Agent
    const agent = await req.prisma.agent.findFirst({
      where: { userId, status: 'BOUND' }
    });
    
    if (!agent) {
      return res.status(403).json({ success: false, message: '没有绑定的 Agent' });
    }
    
    // 检查目标 Agent 是否存在
    const receiverAgent = await req.prisma.agent.findUnique({
      where: { agentId: receiverAgentId }
    });
    
    if (!receiverAgent) {
      return res.status(404).json({ success: false, message: '目标 Agent 不存在' });
    }
    
    // 检查是否已有活跃会话
    const existingSession = await req.prisma.agentChatSession.findFirst({
      where: {
        OR: [
          { initiatorAgentId: agent.agentId, receiverAgentId },
          { initiatorAgentId: receiverAgentId, receiverAgentId: agent.agentId }
        ],
        status: 'ACTIVE'
      }
    });
    
    if (existingSession) {
      return res.status(400).json({ 
        success: false, 
        message: '已存在活跃的会话',
        data: { sessionId: existingSession.id }
      });
    }
    
    // 创建新会话
    const session = await req.prisma.agentChatSession.create({
      data: {
        sessionType: 'DIRECT',
        initiatorAgentId: agent.agentId,
        receiverAgentId,
        status: 'ACTIVE'
      }
    });
    
    res.json({ 
      success: true, 
      message: '会话创建成功',
      data: { sessionId: session.id }
    });
  } catch (error) {
    console.error('创建直接会话失败:', error);
    res.status(500).json({ success: false, message: '创建会话失败' });
  }
});

// Agent 为任务发起聊天
router.post('/sessions/task/:taskId', verifyToken, async (req, res) => {
  try {
    const taskId = parseInt(req.params.taskId);
    const userId = req.user.id;
    
    if (!taskId) {
      return res.status(400).json({ success: false, message: '任务 ID 不能为空' });
    }
    
    // 获取发送者的 Agent
    const agent = await req.prisma.agent.findFirst({
      where: { userId, status: 'BOUND' }
    });
    
    if (!agent) {
      return res.status(403).json({ success: false, message: '没有绑定的 Agent' });
    }
    
    // 获取任务信息
    const task = await req.prisma.task.findUnique({
      where: { id: taskId }
    });
    
    if (!task) {
      return res.status(404).json({ success: false, message: '任务不存在' });
    }
    
    // 判断是雇主还是工人
    let initiatorAgentId = agent.agentId;
    let receiverAgentId;
    
    // 如果用户是任务发布者，需要找到中标者
    if (task.publisherId === userId) {
      if (!task.workerId) {
        return res.status(400).json({ success: false, message: '任务还未分配工人' });
      }
      
      const workerAgent = await req.prisma.agent.findFirst({
        where: { userId: task.workerId, status: 'BOUND' }
      });
      
      if (!workerAgent) {
        return res.status(400).json({ success: false, message: '工人还未绑定 Agent' });
      }
      
      receiverAgentId = workerAgent.agentId;
    } else if (task.workerId === userId) {
      // 如果用户是工人，需要找到发布者
      const publisherAgent = await req.prisma.agent.findFirst({
        where: { userId: task.publisherId, status: 'BOUND' }
      });
      
      if (!publisherAgent) {
        return res.status(400).json({ success: false, message: '雇主还未绑定 Agent' });
      }
      
      receiverAgentId = publisherAgent.agentId;
    } else {
      return res.status(403).json({ success: false, message: '你不是任务的雇主或工人' });
    }
    
    // 检查是否已有活跃会话
    const existingSession = await req.prisma.agentChatSession.findFirst({
      where: {
        taskId: taskId,
        status: 'ACTIVE'
      }
    });
    
    if (existingSession) {
      return res.json({ 
        success: true, 
        message: '已存在活跃的会话',
        data: { sessionId: existingSession.id }
      });
    }
    
    // 创建新会话
    const session = await req.prisma.agentChatSession.create({
      data: {
        sessionType: 'TASK',
        taskId,
        initiatorAgentId,
        receiverAgentId,
        status: 'ACTIVE'
      }
    });
    
    res.json({ 
      success: true, 
      message: '任务会话创建成功',
      data: { sessionId: session.id }
    });
  } catch (error) {
    console.error('创建任务会话失败:', error);
    res.status(500).json({ success: false, message: '创建会话失败' });
  }
});

// 发送消息
router.post('/sessions/:id/messages', verifyToken, async (req, res) => {
  try {
    const sessionId = parseInt(req.params.id);
    const { content } = req.body;
    const userId = req.user.id;
    
    if (!content || content.trim() === '') {
      return res.status(400).json({ success: false, message: '消息内容不能为空' });
    }
    
    // 验证用户是否拥有这个会话中的 Agent
    const agent = await req.prisma.agent.findFirst({
      where: { userId, status: 'BOUND' }
    });
    
    if (!agent) {
      return res.status(403).json({ success: false, message: '没有绑定的 Agent' });
    }
    
    // 验证会话
    const session = await req.prisma.agentChatSession.findFirst({
      where: {
        id: sessionId,
        OR: [
          { initiatorAgentId: agent.agentId },
          { receiverAgentId: agent.agentId }
        ],
        status: 'ACTIVE'
      }
    });
    
    if (!session) {
      return res.status(404).json({ success: false, message: '会话不存在或已结束' });
    }
    
    // 发送消息
    const message = await req.prisma.agentChatMessage.create({
      data: {
        sessionId,
        senderAgentId: agent.agentId,
        content: content.trim(),
        type: 'TEXT',
        readBy: JSON.stringify([agent.agentId])
      }
    });
    
    // 更新会话时间
    await req.prisma.agentChatSession.update({
      where: { id: sessionId },
      data: { updatedAt: new Date() }
    });
    
    res.json({ 
      success: true, 
      message: '消息发送成功',
      data: message
    });
  } catch (error) {
    console.error('发送消息失败:', error);
    res.status(500).json({ success: false, message: '发送消息失败' });
  }
});

// 结束会话
router.post('/sessions/:id/end', verifyToken, async (req, res) => {
  try {
    const sessionId = parseInt(req.params.id);
    const userId = req.user.id;
    
    // 验证用户是否拥有这个会话中的 Agent
    const agent = await req.prisma.agent.findFirst({
      where: { userId, status: 'BOUND' }
    });
    
    if (!agent) {
      return res.status(403).json({ success: false, message: '没有绑定的 Agent' });
    }
    
    // 验证会话
    const session = await req.prisma.agentChatSession.findFirst({
      where: {
        id: sessionId,
        OR: [
          { initiatorAgentId: agent.agentId },
          { receiverAgentId: agent.agentId }
        ],
        status: 'ACTIVE'
      }
    });
    
    if (!session) {
      return res.status(404).json({ success: false, message: '会话不存在' });
    }
    
    // 添加系统消息
    await req.prisma.agentChatMessage.create({
      data: {
        sessionId,
        senderAgentId: null,
        content: '会话已结束',
        type: 'SYSTEM',
        readBy: '[]'
      }
    });
    
    // 结束会话
    await req.prisma.agentChatSession.update({
      where: { id: sessionId },
      data: { 
        status: 'ENDED',
        endedAt: new Date()
      }
    });
    
    res.json({ success: true, message: '会话已结束' });
  } catch (error) {
    console.error('结束会话失败:', error);
    console.error('Error details:', error.message, error.stack);
    res.status(500).json({ success: false, message: '结束会话失败: ' + error.message });
  }
});

// 获取愿意聊天的 Agent 列表
router.get('/available', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // 获取当前用户的 Agent
    const myAgent = await req.prisma.agent.findFirst({
      where: { userId, status: 'BOUND' }
    });
    
    // 获取所有愿意聊天的其他 Agent
    const agents = await req.prisma.agent.findMany({
      where: {
        status: 'BOUND',
        willingToChat: true,
        userId: { not: userId }
      },
      select: {
        agentId: true,
        name: true,
        displayName: true
      }
    });
    
    res.json({ 
      success: true, 
      data: agents,
      myAgent: myAgent ? {
        agentId: myAgent.agentId,
        name: myAgent.name
      } : null
    });
  } catch (error) {
    console.error('获取可用 Agent 失败:', error);
    res.status(500).json({ success: false, message: '获取失败' });
  }
});

export default router;