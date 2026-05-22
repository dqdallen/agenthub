import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const generateAgentId = () => {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let id = 'ag_';
  for (let i = 0; i < 16; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
};

const generateApiKey = () => {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let key = 'ak_';
  for (let i = 0; i < 48; i++) {
    key += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return key;
};

const generateConnectToken = () => {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let token = 'ct_';
  for (let i = 0; i < 32; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
};

let connectTokens = {};

const registerAgent = async (req, res) => {
  try {
    const { name } = req.body;
    
    if (!name) {
      return res.status(400).json({ success: false, message: 'Agent name is required' });
    }

    const existingAgent = await prisma.agent.findFirst({
      where: { name }
    });

    if (existingAgent) {
      return res.status(409).json({ success: false, message: 'Agent name already exists' });
    }

    const agentId = generateAgentId();
    const apiKey = generateApiKey();

    const agent = await prisma.agent.create({
      data: {
        agentId,
        name,
        apiKey,
        status: 'UNBOUND'
      }
    });

    return res.status(201).json({
      success: true,
      message: 'Agent registered successfully',
      data: {
        agentId: agent.agentId,
        apiKey: agent.apiKey,
        name: agent.name,
        status: agent.status,
        createdAt: agent.createdAt
      }
    });
  } catch (error) {
    console.error('Register agent error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

const connectAgent = async (req, res) => {
  try {
    const { agentId, apiKey } = req.body;

    if (!agentId || !apiKey) {
      return res.status(400).json({ success: false, message: 'agentId and apiKey are required' });
    }

    const agent = await prisma.agent.findUnique({
      where: { agentId }
    });

    if (!agent) {
      return res.status(404).json({ success: false, message: 'Agent not found' });
    }

    if (agent.apiKey !== apiKey) {
      return res.status(401).json({ success: false, message: 'Invalid apiKey' });
    }

    if (agent.status === 'REVOKED') {
      return res.status(403).json({ success: false, message: 'Agent has been revoked' });
    }

    if (agent.status === 'BOUND') {
      return res.status(400).json({ success: false, message: 'Agent is already bound' });
    }

    const connectToken = generateConnectToken();
    connectTokens[connectToken] = {
      agentId,
      expiresAt: Date.now() + 60 * 60 * 1000
    };

    const bindUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/agent-bind?token=${connectToken}`;

    return res.status(200).json({
      success: true,
      message: 'Connect token generated',
      data: {
        connectToken,
        bindUrl,
        expiresIn: 3600
      }
    });
  } catch (error) {
    console.error('Connect agent error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

const getBindToken = async (req, res) => {
  try {
    const { token } = req.params;

    if (!connectTokens[token]) {
      return res.status(404).json({ success: false, message: 'Invalid or expired token' });
    }

    if (connectTokens[token].expiresAt < Date.now()) {
      delete connectTokens[token];
      return res.status(404).json({ success: false, message: 'Token expired' });
    }

    const agent = await prisma.agent.findUnique({
      where: { agentId: connectTokens[token].agentId }
    });

    return res.status(200).json({
      success: true,
      data: {
        token,
        agentId: agent.agentId,
        agentName: agent.name,
        expiresAt: connectTokens[token].expiresAt
      }
    });
  } catch (error) {
    console.error('Get bind token error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

const bindAgent = async (req, res) => {
  try {
    const { token } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    if (!token) {
      return res.status(400).json({ success: false, message: 'Token is required' });
    }

    if (!connectTokens[token]) {
      return res.status(404).json({ success: false, message: 'Invalid or expired token' });
    }

    if (connectTokens[token].expiresAt < Date.now()) {
      delete connectTokens[token];
      return res.status(404).json({ success: false, message: 'Token expired' });
    }

    const { agentId } = connectTokens[token];

    const agent = await prisma.agent.findUnique({
      where: { agentId }
    });

    if (!agent) {
      return res.status(404).json({ success: false, message: 'Agent not found' });
    }

    if (agent.status === 'BOUND') {
      return res.status(400).json({ success: false, message: 'Agent is already bound' });
    }

    if (agent.status === 'REVOKED') {
      return res.status(403).json({ success: false, message: 'Agent has been revoked' });
    }

    const existingBind = await prisma.agent.findFirst({
      where: { userId, status: 'BOUND' }
    });

    if (existingBind) {
      return res.status(400).json({ success: false, message: 'You already have a bound agent' });
    }

    const updatedAgent = await prisma.agent.update({
      where: { agentId },
      data: {
        userId,
        status: 'BOUND',
        boundAt: new Date()
      }
    });

    delete connectTokens[token];

    return res.status(200).json({
      success: true,
      message: 'Agent bound successfully',
      data: {
        id: updatedAgent.id,
        agentId: updatedAgent.agentId,
        name: updatedAgent.name,
        status: updatedAgent.status,
        boundAt: updatedAgent.boundAt
      }
    });
  } catch (error) {
    console.error('Bind agent error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

const unbindAgent = async (req, res) => {
  try {
    const { agentId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const agent = await prisma.agent.findUnique({
      where: { agentId }
    });

    if (!agent) {
      return res.status(404).json({ success: false, message: 'Agent not found' });
    }

    if (agent.userId !== userId) {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    const updatedAgent = await prisma.agent.update({
      where: { agentId },
      data: {
        userId: null,
        status: 'UNBOUND',
        boundAt: null
      }
    });

    return res.status(200).json({
      success: true,
      message: 'Agent unbound successfully',
      data: updatedAgent
    });
  } catch (error) {
    console.error('Unbind agent error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

const confirmBind = async (req, res) => {
  try {
    const { connectToken } = req.body;

    if (!connectTokens[connectToken]) {
      return res.status(404).json({ success: false, message: 'Invalid or expired token' });
    }

    if (connectTokens[connectToken].expiresAt < Date.now()) {
      delete connectTokens[connectToken];
      return res.status(404).json({ success: false, message: 'Token expired' });
    }

    const { agentId } = connectTokens[connectToken];

    const agent = await prisma.agent.findUnique({
      where: { agentId },
      include: { user: true }
    });

    if (!agent) {
      return res.status(404).json({ success: false, message: 'Agent not found' });
    }

    if (agent.status !== 'BOUND') {
      return res.status(400).json({ success: false, message: 'Agent not bound yet' });
    }

    delete connectTokens[connectToken];

    return res.status(200).json({
      success: true,
      message: 'Bind confirmed',
      data: {
        agentId: agent.agentId,
        apiKey: agent.apiKey,
        name: agent.name,
        userId: agent.userId,
        userName: agent.user?.name,
        userEmail: agent.user?.email
      }
    });
  } catch (error) {
    console.error('Confirm bind error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

const getMyAgents = async (req, res) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const agents = await prisma.agent.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' }
    });

    return res.status(200).json({
      success: true,
      data: agents
    });
  } catch (error) {
    console.error('Get my agents error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

const getAgentById = async (req, res) => {
  try {
    const { agentId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const agent = await prisma.agent.findUnique({
      where: { agentId }
    });

    if (!agent) {
      return res.status(404).json({ success: false, message: 'Agent not found' });
    }

    if (agent.userId !== userId) {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    return res.status(200).json({
      success: true,
      data: agent
    });
  } catch (error) {
    console.error('Get agent by id error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

const updateAgent = async (req, res) => {
  try {
    const { agentId } = req.params;
    const { name } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const agent = await prisma.agent.findUnique({
      where: { agentId }
    });

    if (!agent) {
      return res.status(404).json({ success: false, message: 'Agent not found' });
    }

    if (agent.userId !== userId) {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    const updatedAgent = await prisma.agent.update({
      where: { agentId },
      data: { name }
    });

    return res.status(200).json({
      success: true,
      message: 'Agent updated successfully',
      data: updatedAgent
    });
  } catch (error) {
    console.error('Update agent error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

const deleteAgent = async (req, res) => {
  try {
    const { agentId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const agent = await prisma.agent.findUnique({
      where: { agentId }
    });

    if (!agent) {
      return res.status(404).json({ success: false, message: 'Agent not found' });
    }

    if (agent.userId !== userId) {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    await prisma.agent.delete({
      where: { agentId }
    });

    return res.status(200).json({
      success: true,
      message: 'Agent deleted successfully'
    });
  } catch (error) {
    console.error('Delete agent error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

const setWillingToChat = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { willingToChat } = req.body;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const agent = await prisma.agent.findFirst({
      where: { userId, status: 'BOUND' }
    });

    if (!agent) {
      return res.status(404).json({ success: false, message: 'No bound agent found' });
    }

    const updatedAgent = await prisma.agent.update({
      where: { agentId: agent.agentId },
      data: { willingToChat: willingToChat === true }
    });

    return res.status(200).json({
      success: true,
      message: willingToChat ? 'Agent is now willing to chat' : 'Agent is no longer willing to chat',
      data: {
        agentId: updatedAgent.agentId,
        willingToChat: updatedAgent.willingToChat
      }
    });
  } catch (error) {
    console.error('Set willing to chat error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export default {
  registerAgent,
  connectAgent,
  confirmBind,
  getBindToken,
  bindAgent,
  unbindAgent,
  getMyAgents,
  getAgentById,
  updateAgent,
  deleteAgent,
  setWillingToChat
};