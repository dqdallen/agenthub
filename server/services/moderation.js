import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const SENSITIVE_PATTERNS = [
  /\b(傻逼|智障|废物|垃圾|没用的|滚|滚蛋|白痴|弱智)\b/gi,
  /\b(操|他妈|你妈|狗屎|大便|尿)\b/gi,
  /\b(杀人|自杀|毒品|赌博)\b/gi,
  /\b(种族歧视|性别歧视|地域黑)\b/gi,
  /\b(外挂|破解|盗号)\b/gi,
]

const REJECT_REASONS = {
  'abuse': '包含侮辱性语言',
  'violence': '包含暴力相关内容',
  'discrimination': '包含歧视性内容',
  'illegal': '包含违法内容',
  'spam': '包含垃圾信息特征'
}

export const contentModeration = {
  async checkContent(content) {
    const result = {
      passed: true,
      reason: null,
      level: null
    }

    for (const pattern of SENSITIVE_PATTERNS) {
      if (pattern.test(content)) {
        result.passed = false
        result.level = 'STRICT'
        
        if (pattern.source.includes('傻逼|智障|废物')) {
          result.reason = REJECT_REASONS['abuse']
        } else if (pattern.source.includes('杀人|自杀|毒品')) {
          result.reason = REJECT_REASONS['violence']
        } else if (pattern.source.includes('种族歧视')) {
          result.reason = REJECT_REASONS['discrimination']
        } else if (pattern.source.includes('外挂|破解')) {
          result.reason = REJECT_REASONS['illegal']
        } else {
          result.reason = '包含不当内容'
        }
        
        break
      }
    }

    if (content.length > 2000) {
      result.passed = false
      result.reason = '内容过长，请控制在2000字以内'
      result.level = 'NORMAL'
    }

    if (content.length < 5) {
      result.passed = false
      result.reason = '内容过短，请至少输入5个字符'
      result.level = 'NORMAL'
    }

    return result
  },

  async checkAndSaveWord(word, level = 'STRICT') {
    const existing = await prisma.sensitiveWord.findUnique({
      where: { word }
    })

    if (existing) {
      return existing
    }

    return await prisma.sensitiveWord.create({
      data: { word, level }
    })
  },

  async getAllSensitiveWords() {
    return await prisma.sensitiveWord.findMany({
      orderBy: { createdAt: 'desc' }
    })
  },

  async deleteSensitiveWord(id) {
    return await prisma.sensitiveWord.delete({
      where: { id }
    })
  }
}

export default contentModeration
