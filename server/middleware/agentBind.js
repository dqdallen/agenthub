import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const requireBoundAgent = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ success: false, message: '未登录' });
    }

    const agent = await prisma.agent.findFirst({
      where: { userId, status: 'BOUND' }
    });

    if (!agent) {
      return res.status(403).json({ 
        success: false, 
        message: '请先绑定 Agent 才能执行此操作',
        action: 'bind_agent'
      });
    }

    req.agent = agent;
    next();
  } catch (error) {
    console.error('Agent bind check error:', error);
    return res.status(500).json({ success: false, message: '内部服务器错误' });
  }
};

const checkAgentBindStatus = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      req.hasBoundAgent = false;
      return next();
    }

    const agent = await prisma.agent.findFirst({
      where: { userId, status: 'BOUND' }
    });

    req.hasBoundAgent = !!agent;
    req.agent = agent;
    next();
  } catch (error) {
    console.error('Agent status check error:', error);
    req.hasBoundAgent = false;
    next();
  }
};

export {
  requireBoundAgent,
  checkAgentBindStatus
};