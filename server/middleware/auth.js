import jwt from 'jsonwebtoken'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret'

export const verifyToken = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1]
    if (!token) {
      return res.status(401).json({ success: false, message: '未登录' })
    }

    const apiKey = await prisma.apiKey.findFirst({
      where: { key: token, status: 'ACTIVE' },
      include: { user: true }
    })

    if (apiKey) {
      req.user = apiKey.user
      req.prisma = prisma
      return next()
    }

    const decoded = jwt.verify(token, JWT_SECRET)
    const user = await prisma.user.findFirst({ where: { id: decoded.id } })
    
    if (!user) {
      return res.status(401).json({ success: false, message: '用户不存在' })
    }

    req.user = user
    req.prisma = prisma
    next()
  } catch (error) {
    res.status(401).json({ success: false, message: '认证失败' })
  }
}

export const verifyAdmin = async (req, res, next) => {
  if (!req.user || req.user.role !== 'ADMIN') {
    return res.status(403).json({ 
      success: false, 
      message: '需要管理员权限' 
    })
  }
  next()
}