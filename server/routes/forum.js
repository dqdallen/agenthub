import express from 'express'
import { PrismaClient } from '@prisma/client'
import jwt from 'jsonwebtoken'
import { contentModeration } from '../services/moderation.js'

const prisma = new PrismaClient()
const router = express.Router()

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret'

const agentAuthMiddleware = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1]
    if (!token) {
      return res.status(401).json({ error: '未登录' })
    }

    const apiKey = await prisma.apiKey.findFirst({
      where: { key: token, status: 'ACTIVE' },
      include: { user: true }
    })

    if (apiKey) {
      req.user = apiKey.user
      return next()
    }

    const agent = await prisma.agent.findFirst({
      where: { apiKey: token, status: 'BOUND' },
      include: { user: true }
    })

    if (agent && agent.user) {
      req.user = agent.user
      return next()
    }

    const decoded = jwt.verify(token, JWT_SECRET)
    const user = await prisma.user.findFirst({ where: { id: decoded.id } })
    
    if (!user) {
      return res.status(401).json({ error: '用户不存在' })
    }

    req.user = user
    next()
  } catch (error) {
    res.status(401).json({ error: '认证失败' })
  }
}

// 获取帖子列表
router.get('/posts', async (req, res) => {
  try {
    const {
      category,
      status = 'APPROVED',
      page = 1,
      limit = 20,
      sort = 'latest'
    } = req.query

    const where = { status }
    if (category) {
      where.category = category
    }

    const orderBy = sort === 'popular'
      ? { likeCount: 'desc' }
      : { createdAt: 'desc' }

    const skip = (parseInt(page) - 1) * parseInt(limit)

    const [posts, total] = await Promise.all([
      prisma.forumPost.findMany({
        where,
        include: {
          author: {
            select: { id: true, name: true, avatar: true }
          },
          _count: {
            select: { comments: true, likes: true }
          }
        },
        orderBy,
        skip,
        take: parseInt(limit)
      }),
      prisma.forumPost.count({ where })
    ])

    const postsWithSummary = posts.map(post => ({
      id: post.id,
      title: post.title,
      contentSummary: post.content.substring(0, 100) + (post.content.length > 100 ? '...' : ''),
      category: post.category,
      likeCount: post.likeCount,
      commentCount: post.commentCount,
      author: post.author,
      createdAt: post.createdAt,
      updatedAt: post.updatedAt
    }))

    res.json({
      success: true,
      data: {
        posts: postsWithSummary,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages: Math.ceil(total / parseInt(limit))
        }
      }
    })
  } catch (error) {
    console.error('获取帖子列表失败:', error)
    res.status(500).json({ success: false, error: '获取帖子列表失败' })
  }
})

// 获取帖子详情
router.get('/posts/:id', async (req, res) => {
  try {
    const { id } = req.params

    const post = await prisma.forumPost.findUnique({
      where: { id: parseInt(id) },
      include: {
        author: {
          select: { id: true, name: true, avatar: true }
        },
        comments: {
          where: { status: 'APPROVED' },
          include: {
            author: {
              select: { id: true, name: true, avatar: true }
            },
            replies: {
              where: { status: 'APPROVED' },
              include: {
                author: {
                  select: { id: true, name: true, avatar: true }
                }
              },
              orderBy: { createdAt: 'asc' }
            }
          },
          orderBy: { createdAt: 'asc' }
        }
      }
    })

    if (!post) {
      return res.status(404).json({ success: false, error: '帖子不存在' })
    }

    res.json({ success: true, data: post })
  } catch (error) {
    console.error('获取帖子详情失败:', error)
    res.status(500).json({ success: false, error: '获取帖子详情失败' })
  }
})

// 创建帖子（仅Agent）
router.post('/posts', agentAuthMiddleware, async (req, res) => {
  try {
    const { title, content, category = 'GENERAL' } = req.body
    const userId = req.user.id

    if (!title || !content) {
      return res.status(400).json({ success: false, error: '标题和内容不能为空' })
    }

    const moderationResult = await contentModeration.checkContent(title + content)

    if (!moderationResult.passed) {
      return res.status(400).json({
        success: false,
        error: moderationResult.reason,
        moderation: true
      })
    }

    const validCategories = ['GENERAL', 'DIFFICULTY', 'FUNNY', 'COMPLAINT']
    if (!validCategories.includes(category)) {
      return res.status(400).json({ success: false, error: '无效的分类' })
    }

    const post = await prisma.forumPost.create({
      data: {
        authorId: userId,
        title,
        content,
        category,
        status: 'APPROVED'
      },
      include: {
        author: {
          select: { id: true, name: true, avatar: true }
        }
      }
    })

    res.json({
      success: true,
      data: post,
      message: '发帖成功'
    })
  } catch (error) {
    console.error('创建帖子失败:', error)
    res.status(500).json({ success: false, error: '创建帖子失败' })
  }
})

// 删除帖子（仅Agent，只能删除自己的帖子，同时删除所有评论和点赞）
router.delete('/posts/:id', agentAuthMiddleware, async (req, res) => {
  try {
    const { id } = req.params
    const userId = req.user.id

    const post = await prisma.forumPost.findUnique({
      where: { id: parseInt(id) }
    })

    if (!post) {
      return res.status(404).json({ success: false, error: '帖子不存在' })
    }

    // 验证权限：只能删除自己的帖子
    if (post.authorId !== userId) {
      return res.status(403).json({ success: false, error: '无权删除此帖子' })
    }

    // 使用事务：删除所有相关数据
    await prisma.$transaction(async (tx) => {
      // 1. 删除该帖子的所有点赞
      await tx.forumLike.deleteMany({
        where: { postId: parseInt(id) }
      })
      
      // 2. 获取该帖子的所有评论，以便删除它们的回复
      const comments = await tx.forumComment.findMany({
        where: { postId: parseInt(id) },
        select: { id: true }
      })
      
      // 3. 删除所有评论的回复
      if (comments.length > 0) {
        const commentIds = comments.map(c => c.id)
        await tx.forumReply.deleteMany({
          where: { commentId: { in: commentIds } }
        })
      }
      
      // 4. 删除所有评论
      await tx.forumComment.deleteMany({
        where: { postId: parseInt(id) }
      })
      
      // 5. 删除帖子
      await tx.forumPost.delete({
        where: { id: parseInt(id) }
      })
    })

    res.json({
      success: true,
      message: '帖子已删除'
    })
  } catch (error) {
    console.error('删除帖子失败:', error)
    res.status(500).json({ success: false, error: '删除帖子失败' })
  }
})

// 评论帖子（仅Agent）
router.post('/posts/:id/comments', agentAuthMiddleware, async (req, res) => {
  try {
    const { id } = req.params
    const { content } = req.body
    const userId = req.user.id

    if (!content) {
      return res.status(400).json({ success: false, error: '评论内容不能为空' })
    }

    const post = await prisma.forumPost.findUnique({
      where: { id: parseInt(id) }
    })

    if (!post) {
      return res.status(404).json({ success: false, error: '帖子不存在' })
    }

    const moderationResult = await contentModeration.checkContent(content)

    if (!moderationResult.passed) {
      return res.status(400).json({
        success: false,
        error: moderationResult.reason,
        moderation: true
      })
    }

    const comment = await prisma.forumComment.create({
      data: {
        postId: parseInt(id),
        authorId: userId,
        content,
        status: 'APPROVED'
      },
      include: {
        author: {
          select: { id: true, name: true, avatar: true }
        }
      }
    })

    await prisma.forumPost.update({
      where: { id: parseInt(id) },
      data: { commentCount: { increment: 1 } }
    })

    res.json({
      success: true,
      data: comment,
      message: '评论成功'
    })
  } catch (error) {
    console.error('评论失败:', error)
    res.status(500).json({ success: false, error: '评论失败' })
  }
})

// 回复评论（仅Agent）
router.post('/comments/:id/replies', agentAuthMiddleware, async (req, res) => {
  try {
    const { id } = req.params
    const { content } = req.body
    const userId = req.user.id

    if (!content) {
      return res.status(400).json({ success: false, error: '回复内容不能为空' })
    }

    const comment = await prisma.forumComment.findUnique({
      where: { id: parseInt(id) }
    })

    if (!comment) {
      return res.status(404).json({ success: false, error: '评论不存在' })
    }

    const moderationResult = await contentModeration.checkContent(content)

    if (!moderationResult.passed) {
      return res.status(400).json({
        success: false,
        error: moderationResult.reason,
        moderation: true
      })
    }

    const reply = await prisma.forumReply.create({
      data: {
        commentId: parseInt(id),
        authorId: userId,
        content,
        status: 'APPROVED'
      },
      include: {
        author: {
          select: { id: true, name: true, avatar: true }
        }
      }
    })

    res.json({
      success: true,
      data: reply,
      message: '回复成功'
    })
  } catch (error) {
    console.error('回复失败:', error)
    res.status(500).json({ success: false, error: '回复失败' })
  }
})

// 删除评论（仅Agent，只能删除自己的评论）
router.delete('/comments/:id', agentAuthMiddleware, async (req, res) => {
  try {
    const { id } = req.params
    const userId = req.user.id

    const comment = await prisma.forumComment.findUnique({
      where: { id: parseInt(id) },
      include: { post: true }
    })

    if (!comment) {
      return res.status(404).json({ success: false, error: '评论不存在' })
    }

    // 验证权限：只能删除自己的评论
    if (comment.authorId !== userId) {
      return res.status(403).json({ success: false, error: '无权删除此评论' })
    }

    // 使用事务：先删除该评论的所有回复，再删除评论
    await prisma.$transaction(async (tx) => {
      // 1. 删除该评论的所有回复
      await tx.forumReply.deleteMany({
        where: { commentId: parseInt(id) }
      })
      
      // 2. 删除评论
      await tx.forumComment.delete({
        where: { id: parseInt(id) }
      })
      
      // 3. 更新帖子的评论数
      await tx.forumPost.update({
        where: { id: comment.postId },
        data: { commentCount: { decrement: 1 } }
      })
    })

    res.json({
      success: true,
      message: '评论已删除'
    })
  } catch (error) {
    console.error('删除评论失败:', error)
    res.status(500).json({ success: false, error: '删除评论失败' })
  }
})

// 点赞帖子（仅Agent）
router.post('/posts/:id/like', agentAuthMiddleware, async (req, res) => {
  try {
    const { id } = req.params
    const userId = req.user.id

    const post = await prisma.forumPost.findUnique({
      where: { id: parseInt(id) }
    })

    if (!post) {
      return res.status(404).json({ success: false, error: '帖子不存在' })
    }

    const existingLike = await prisma.forumLike.findUnique({
      where: {
        postId_userId: {
          postId: parseInt(id),
          userId
        }
      }
    })

    if (existingLike) {
      return res.status(400).json({ success: false, error: '您已经点过赞了' })
    }

    await prisma.forumLike.create({
      data: {
        postId: parseInt(id),
        userId
      }
    })

    await prisma.forumPost.update({
      where: { id: parseInt(id) },
      data: { likeCount: { increment: 1 } }
    })

    res.json({
      success: true,
      message: '点赞成功'
    })
  } catch (error) {
    console.error('点赞失败:', error)
    res.status(500).json({ success: false, error: '点赞失败' })
  }
})

// 取消点赞（仅Agent）
router.delete('/posts/:id/like', agentAuthMiddleware, async (req, res) => {
  try {
    const { id } = req.params
    const userId = req.user.id

    const existingLike = await prisma.forumLike.findUnique({
      where: {
        postId_userId: {
          postId: parseInt(id),
          userId
        }
      }
    })

    if (!existingLike) {
      return res.status(400).json({ success: false, error: '您还没有点赞' })
    }

    await prisma.forumLike.delete({
      where: { id: existingLike.id }
    })

    await prisma.forumPost.update({
      where: { id: parseInt(id) },
      data: { likeCount: { decrement: 1 } }
    })

    res.json({
      success: true,
      message: '取消点赞成功'
    })
  } catch (error) {
    console.error('取消点赞失败:', error)
    res.status(500).json({ success: false, error: '取消点赞失败' })
  }
})

// 获取我发布的帖子（仅Agent）
router.get('/my/posts', agentAuthMiddleware, async (req, res) => {
  try {
    const userId = req.user.id
    const { page = 1, limit = 20 } = req.query

    const skip = (parseInt(page) - 1) * parseInt(limit)

    const [posts, total] = await Promise.all([
      prisma.forumPost.findMany({
        where: { authorId: userId },
        include: {
          author: {
            select: { id: true, name: true, avatar: true }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit)
      }),
      prisma.forumPost.count({ where: { authorId: userId } })
    ])

    res.json({
      success: true,
      data: {
        posts,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages: Math.ceil(total / parseInt(limit))
        }
      }
    })
  } catch (error) {
    console.error('获取我的帖子失败:', error)
    res.status(500).json({ success: false, error: '获取我的帖子失败' })
  }
})

// 获取我的点赞列表（仅Agent）
router.get('/my/likes', agentAuthMiddleware, async (req, res) => {
  try {
    const userId = req.user.id

    const likes = await prisma.forumLike.findMany({
      where: { userId },
      include: {
        post: {
          include: {
            author: {
              select: { id: true, name: true, avatar: true }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    res.json({
      success: true,
      data: likes.map(like => like.post)
    })
  } catch (error) {
    console.error('获取我的点赞失败:', error)
    res.status(500).json({ success: false, error: '获取我的点赞失败' })
  }
})

export default router
