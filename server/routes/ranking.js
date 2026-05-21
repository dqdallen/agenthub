import express from 'express'
import { PrismaClient } from '@prisma/client'

const router = express.Router()
const prisma = new PrismaClient()

// 获取用户积分排名
router.get('/points', async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query
    const skip = (parseInt(page) - 1) * parseInt(limit)

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        select: {
          id: true,
          name: true,
          avatar: true,
          points: true,
          role: true,
          createdAt: true,
          _count: {
            select: {
              forumPosts: true
            }
          }
        },
        orderBy: { points: 'desc' },
        skip,
        take: parseInt(limit)
      }),
      prisma.user.count()
    ])

    const ranking = users.map((user, index) => ({
      rank: skip + index + 1,
      ...user,
      totalPosts: user._count.forumPosts
    }))

    res.json({
      success: true,
      data: {
        ranking,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages: Math.ceil(total / parseInt(limit))
        }
      }
    })
  } catch (error) {
    console.error('获取积分排名失败:', error)
    res.status(500).json({ success: false, error: '获取积分排名失败' })
  }
})

// 获取用户点赞数排名
router.get('/likes', async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query
    const skip = (parseInt(page) - 1) * parseInt(limit)

    // 先获取所有帖子及其作者和点赞数
    const posts = await prisma.forumPost.findMany({
      select: {
        id: true,
        authorId: true,
        _count: {
          select: {
            likes: true
          }
        }
      }
    })

    // 按作者统计总点赞数
    const authorLikesMap = new Map()
    posts.forEach(post => {
      const currentLikes = authorLikesMap.get(post.authorId) || 0
      authorLikesMap.set(post.authorId, currentLikes + post._count.likes)
    })

    // 获取所有用户
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        avatar: true,
        points: true,
        role: true,
        createdAt: true,
        _count: {
          select: {
            forumPosts: true
          }
        }
      }
    })

    // 组合用户信息和点赞数
    const usersWithLikes = users.map(user => ({
      id: user.id,
      name: user.name,
      avatar: user.avatar,
      points: user.points,
      role: user.role,
      createdAt: user.createdAt,
      totalPosts: user._count.forumPosts,
      totalLikes: authorLikesMap.get(user.id) || 0
    }))

    // 按点赞数排序
    usersWithLikes.sort((a, b) => b.totalLikes - a.totalLikes)

    // 分页
    const ranking = usersWithLikes.slice(skip, skip + parseInt(limit)).map((user, index) => ({
      rank: skip + index + 1,
      ...user
    }))

    res.json({
      success: true,
      data: {
        ranking,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: users.length,
          totalPages: Math.ceil(users.length / parseInt(limit))
        }
      }
    })
  } catch (error) {
    console.error('获取点赞排名失败:', error)
    res.status(500).json({ success: false, error: '获取点赞排名失败' })
  }
})

// 获取综合排名（积分 + 点赞数）
router.get('/comprehensive', async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query
    const skip = (parseInt(page) - 1) * parseInt(limit)

    // 先获取所有帖子及其作者和点赞数
    const posts = await prisma.forumPost.findMany({
      select: {
        id: true,
        authorId: true,
        _count: {
          select: {
            likes: true
          }
        }
      }
    })

    // 按作者统计总点赞数
    const authorLikesMap = new Map()
    posts.forEach(post => {
      const currentLikes = authorLikesMap.get(post.authorId) || 0
      authorLikesMap.set(post.authorId, currentLikes + post._count.likes)
    })

    // 获取所有用户
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        avatar: true,
        points: true,
        role: true,
        createdAt: true,
        _count: {
          select: {
            forumPosts: true
          }
        }
      }
    })

    // 计算最大积分和最大点赞数用于归一化
    const maxPoints = Math.max(...users.map(u => u.points), 1)
    const maxLikes = Math.max(...Array.from(authorLikesMap.values()), 1)

    // 组合用户信息和计算综合得分
    const usersWithScore = users.map(user => {
      const totalLikes = authorLikesMap.get(user.id) || 0
      const normalizedPoints = (user.points / maxPoints) * 100
      const normalizedLikes = (totalLikes / maxLikes) * 100
      const score = normalizedPoints * 0.6 + normalizedLikes * 0.4

      return {
        id: user.id,
        name: user.name,
        avatar: user.avatar,
        points: user.points,
        role: user.role,
        createdAt: user.createdAt,
        totalPosts: user._count.forumPosts,
        totalLikes,
        score: Math.round(score * 100) / 100
      }
    })

    // 按综合得分排序
    usersWithScore.sort((a, b) => b.score - a.score)

    // 分页
    const ranking = usersWithScore.slice(skip, skip + parseInt(limit)).map((user, index) => ({
      rank: skip + index + 1,
      ...user
    }))

    res.json({
      success: true,
      data: {
        ranking,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: users.length,
          totalPages: Math.ceil(users.length / parseInt(limit))
        }
      }
    })
  } catch (error) {
    console.error('获取综合排名失败:', error)
    res.status(500).json({ success: false, error: '获取综合排名失败' })
  }
})

export default router
