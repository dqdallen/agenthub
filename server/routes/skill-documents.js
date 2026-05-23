import { PrismaClient } from '@prisma/client';
import express from 'express';

const prisma = new PrismaClient();
const router = express.Router();

// =========================
// 公开 API（读取）
// =========================

// 获取所有激活的文档（公开）
router.get('/public', async (req, res) => {
  try {
    const documents = await prisma.skillDocument.findMany({
      where: { isActive: true },
      select: {
        id: true,
        key: true,
        name: true,
        description: true,
        content: true,
        version: true,
        updatedAt: true
      }
    });

    res.json({
      success: true,
      data: documents
    });
  } catch (error) {
    console.error('获取公开文档失败:', error);
    res.status(500).json({ success: false, error: '获取文档失败' });
  }
});

// 根据 key 获取单个文档（公开）
router.get('/public/:key', async (req, res) => {
  try {
    const { key } = req.params;
    const document = await prisma.skillDocument.findFirst({
      where: { key, isActive: true }
    });

    if (!document) {
      return res.status(404).json({ success: false, error: '文档不存在' });
    }

    res.json({
      success: true,
      data: {
        id: document.id,
        key: document.key,
        name: document.name,
        description: document.description,
        content: document.content,
        version: document.version,
        updatedAt: document.updatedAt
      }
    });
  } catch (error) {
    console.error('获取文档失败:', error);
    res.status(500).json({ success: false, error: '获取文档失败' });
  }
});

// =========================
// 管理 API（需要管理员权限）
// =========================

// 管理员中间件
const adminMiddleware = async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id }
    });

    if (!user || user.role !== 'ADMIN') {
      return res.status(403).json({ success: false, error: '需要管理员权限' });
    }

    next();
  } catch (error) {
    console.error('验证管理员权限失败:', error);
    res.status(500).json({ success: false, error: '验证权限失败' });
  }
};

// 获取所有文档（包括未激活）
router.get('/', async (req, res) => {
  try {
    const documents = await prisma.skillDocument.findMany({
      include: {
        lastEditor: {
          select: { id: true, name: true }
        }
      },
      orderBy: { updatedAt: 'desc' }
    });

    res.json({ success: true, data: documents });
  } catch (error) {
    console.error('获取文档列表失败:', error);
    res.status(500).json({ success: false, error: '获取文档列表失败' });
  }
});

// 获取单个文档详情
router.get('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const document = await prisma.skillDocument.findUnique({
      where: { id },
      include: {
        lastEditor: {
          select: { id: true, name: true }
        }
      }
    });

    if (!document) {
      return res.status(404).json({ success: false, error: '文档不存在' });
    }

    res.json({ success: true, data: document });
  } catch (error) {
    console.error('获取文档详情失败:', error);
    res.status(500).json({ success: false, error: '获取文档详情失败' });
  }
});

// 创建新文档
router.post('/', async (req, res) => {
  try {
    const { key, name, description, content, version = '1.0.0', isActive = true } = req.body;

    if (!key || !name || !content) {
      return res.status(400).json({
        success: false,
        error: '缺少必填字段：key, name, content'
      });
    }

    const existing = await prisma.skillDocument.findFirst({ where: { key } });
    if (existing) {
      return res.status(400).json({
        success: false,
        error: `文档 key "${key}" 已存在`
      });
    }

    const document = await prisma.skillDocument.create({
      data: {
        key,
        name,
        description,
        content,
        version,
        isActive,
        lastEditorId: req.user.id
      }
    });

    res.json({ success: true, data: document });
  } catch (error) {
    console.error('创建文档失败:', error);
    res.status(500).json({ success: false, error: '创建文档失败' });
  }
});

// 更新文档
router.put('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { key, name, description, content, version, isActive } = req.body;

    const existing = await prisma.skillDocument.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ success: false, error: '文档不存在' });
    }

    // 检查 key 冲突（如果有修改 key）
    if (key && key !== existing.key) {
      const keyConflict = await prisma.skillDocument.findFirst({ where: { key } });
      if (keyConflict) {
        return res.status(400).json({
          success: false,
          error: `文档 key "${key}" 已存在`
        });
      }
    }

    const document = await prisma.skillDocument.update({
      where: { id },
      data: {
        key: key !== undefined ? key : existing.key,
        name: name !== undefined ? name : existing.name,
        description: description !== undefined ? description : existing.description,
        content: content !== undefined ? content : existing.content,
        version: version !== undefined ? version : existing.version,
        isActive: isActive !== undefined ? isActive : existing.isActive,
        lastEditorId: req.user.id
      }
    });

    res.json({ success: true, data: document });
  } catch (error) {
    console.error('更新文档失败:', error);
    res.status(500).json({ success: false, error: '更新文档失败' });
  }
});

// 删除文档
router.delete('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);

    const document = await prisma.skillDocument.findUnique({ where: { id } });
    if (!document) {
      return res.status(404).json({ success: false, error: '文档不存在' });
    }

    await prisma.skillDocument.delete({ where: { id } });

    res.json({ success: true, message: '文档已删除' });
  } catch (error) {
    console.error('删除文档失败:', error);
    res.status(500).json({ success: false, error: '删除文档失败' });
  }
});

export default router;
