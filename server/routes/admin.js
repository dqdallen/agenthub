import express from 'express'
import { PrismaClient } from '@prisma/client'
import { verifyToken, verifyAdmin } from '../middleware/auth.js'

const prisma = new PrismaClient()
const router = express.Router()

// 获取统计数据
router.get('/stats', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const [
      pendingTasks,
      pendingPosts,
      pendingComments,
      totalUsers,
      totalPosts
    ] = await Promise.all([
      prisma.task.count({ where: { status: 'PENDING' } }),
      prisma.forumPost.count({ where: { status: 'PENDING' } }),
      prisma.forumComment.count({ where: { status: 'PENDING' } }),
      prisma.user.count(),
      prisma.forumPost.count()
    ]);

    res.json({
      success: true,
      data: {
        pendingTasks,
        pendingPosts,
        pendingComments,
        totalUsers,
        totalPosts
      }
    });
  } catch (error) {
    console.error('获取统计数据失败:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
});

// 获取待审核任务列表
router.get('/tasks/pending', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const tasks = await prisma.task.findMany({
      where: { status: 'PENDING' },
      include: {
        publisher: {
          select: { id: true, name: true, email: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({ success: true, data: tasks });
  } catch (error) {
    console.error('获取待审核任务失败:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
});

// 审核任务
router.post('/tasks/:id/review', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { action } = req.body;

    const task = await prisma.task.findUnique({ where: { id: parseInt(id) } });
    if (!task) {
      return res.status(404).json({ success: false, message: '任务不存在' });
    }

    if (task.status !== 'PENDING') {
      return res.status(400).json({ success: false, message: '任务已审核' });
    }

    const newStatus = action === 'approve' ? 'OPEN' : 'REJECTED';

    const updatedTask = await prisma.task.update({
      where: { id: parseInt(id) },
      data: { status: newStatus },
      include: {
        publisher: {
          select: { id: true, name: true, email: true }
        }
      }
    });

    res.json({ success: true, data: updatedTask });
  } catch (error) {
    console.error('审核任务失败:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
});

// 获取待审核帖子
router.get('/posts/pending', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const posts = await prisma.forumPost.findMany({
      where: { status: 'PENDING' },
      include: {
        author: {
          select: { id: true, name: true, email: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({ success: true, data: posts });
  } catch (error) {
    console.error('获取待审核帖子失败:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
});

// 获取所有帖子（带筛选）
router.get('/posts', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { status, category } = req.query;
    
    const where = {};
    if (status) where.status = status;
    if (category) where.category = category;

    const posts = await prisma.forumPost.findMany({
      where,
      include: {
        author: {
          select: { id: true, name: true, email: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({ success: true, data: posts });
  } catch (error) {
    console.error('获取帖子失败:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
});

// 审核帖子
router.post('/posts/:id/review', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { action, reason } = req.body;

    const post = await prisma.forumPost.findUnique({ where: { id: parseInt(id) } });
    if (!post) {
      return res.status(404).json({ success: false, message: '帖子不存在' });
    }

    const newStatus = action === 'approve' ? 'APPROVED' : 'REJECTED';

    const updatedPost = await prisma.forumPost.update({
      where: { id: parseInt(id) },
      data: {
        status: newStatus,
        rejectReason: action === 'reject' ? reason : null
      },
      include: {
        author: {
          select: { id: true, name: true, email: true }
        }
      }
    });

    res.json({ success: true, data: updatedPost });
  } catch (error) {
    console.error('审核帖子失败:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
});

// 删除帖子
router.delete('/posts/:id', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.forumPost.delete({ where: { id: parseInt(id) } });

    res.json({ success: true, message: '帖子已删除' });
  } catch (error) {
    console.error('删除帖子失败:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
});

// 获取待审核评论
router.get('/comments/pending', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const comments = await prisma.forumComment.findMany({
      where: { status: 'PENDING' },
      include: {
        author: {
          select: { id: true, name: true, email: true }
        },
        post: {
          select: { id: true, title: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({ success: true, data: comments });
  } catch (error) {
    console.error('获取待审核评论失败:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
});

// 获取所有评论（带筛选）
router.get('/comments', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { status } = req.query;
    
    const where = {};
    if (status) where.status = status;

    const comments = await prisma.forumComment.findMany({
      where,
      include: {
        author: {
          select: { id: true, name: true, email: true }
        },
        post: {
          select: { id: true, title: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({ success: true, data: comments });
  } catch (error) {
    console.error('获取评论失败:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
});

// 审核评论
router.post('/comments/:id/review', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { action, reason } = req.body;

    const comment = await prisma.forumComment.findUnique({ where: { id: parseInt(id) } });
    if (!comment) {
      return res.status(404).json({ success: false, message: '评论不存在' });
    }

    const newStatus = action === 'approve' ? 'APPROVED' : 'REJECTED';

    const updatedComment = await prisma.forumComment.update({
      where: { id: parseInt(id) },
      data: {
        status: newStatus,
        rejectReason: action === 'reject' ? reason : null
      },
      include: {
        author: {
          select: { id: true, name: true, email: true }
        },
        post: {
          select: { id: true, title: true }
        }
      }
    });

    res.json({ success: true, data: updatedComment });
  } catch (error) {
    console.error('审核评论失败:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
});

// 删除评论
router.delete('/comments/:id', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.forumComment.delete({ where: { id: parseInt(id) } });

    res.json({ success: true, message: '评论已删除' });
  } catch (error) {
    console.error('删除评论失败:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
});

// 获取所有用户列表
router.get('/users', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        points: true,
        isVerified: true,
        createdAt: true
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({ success: true, data: users });
  } catch (error) {
    console.error('获取用户列表失败:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
});

// 更新用户角色
router.put('/users/:id/role', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    if (!['USER', 'AGENT', 'ADMIN'].includes(role)) {
      return res.status(400).json({ success: false, message: '无效的角色' });
    }

    const updatedUser = await prisma.user.update({
      where: { id: parseInt(id) },
      data: { role },
      select: {
        id: true,
        name: true,
        email: true,
        role: true
      }
    });

    res.json({ success: true, data: updatedUser });
  } catch (error) {
    console.error('更新用户角色失败:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
});

export default router
