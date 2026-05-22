import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Clock, Users, Tag, Code, Palette, FileText, Database, MoreHorizontal, Bot, AlertTriangle } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import clsx from 'clsx'
import PointsIcon from '@/components/PointsIcon/PointsIcon'

const categoryConfig = {
  DEVELOPMENT: { icon: Code, color: 'bg-blue-500', label: '开发' },
  DESIGN: { icon: Palette, color: 'bg-pink-500', label: '设计' },
  CONTENT: { icon: FileText, color: 'bg-green-500', label: '内容' },
  DATA: { icon: Database, color: 'bg-purple-500', label: '数据' },
  OTHER: { icon: MoreHorizontal, color: 'bg-gray-500', label: '其他' },
  development: { icon: Code, color: 'bg-blue-500', label: '开发' },
  design: { icon: Palette, color: 'bg-pink-500', label: '设计' },
  content: { icon: FileText, color: 'bg-green-500', label: '内容' },
  data: { icon: Database, color: 'bg-purple-500', label: '数据' },
  other: { icon: MoreHorizontal, color: 'bg-gray-500', label: '其他' },
}

const statusConfig = {
  OPEN: { color: 'bg-success-500/20 text-success-400', label: '可投标' },
  IN_PROGRESS: { color: 'bg-warning-500/20 text-warning-400', label: '进行中' },
  PENDING_REVIEW: { color: 'bg-primary-500/20 text-primary-400', label: '待验收' },
  COMPLETED: { color: 'bg-gray-500/20 text-gray-400', label: '已完成' },
  DRAFT: { color: 'bg-gray-500/20 text-gray-400', label: '草稿' },
  PENDING_PAYMENT: { color: 'bg-warning-500/20 text-warning-400', label: '待支付' },
  CANCELLED: { color: 'bg-red-500/20 text-red-400', label: '已取消' },
  DISPUTED: { color: 'bg-red-500/20 text-red-400', label: '争议中' },
  open: { color: 'bg-success-500/20 text-success-400', label: '可投标' },
  in_progress: { color: 'bg-warning-500/20 text-warning-400', label: '进行中' },
  pending_review: { color: 'bg-primary-500/20 text-primary-400', label: '待验收' },
  completed: { color: 'bg-gray-500/20 text-gray-400', label: '已完成' },
}

const urgencyConfig = {
  NORMAL: { color: 'text-gray-400', label: '普通' },
  URGENT: { color: 'text-warning-400', label: '加急' },
  CRITICAL: { color: 'text-red-400', label: '紧急' },
  normal: { color: 'text-gray-400', label: '普通' },
  urgent: { color: 'text-warning-400', label: '加急' },
  critical: { color: 'text-red-400', label: '紧急' },
}

function TaskCard({ task, index = 0 }) {
  const category = categoryConfig[task.category?.toUpperCase()] || categoryConfig.OTHER
  const status = statusConfig[task.status] || statusConfig.OPEN
  const urgency = urgencyConfig[task.urgency] || urgencyConfig.NORMAL
  const Icon = category.icon
  
  const skills = typeof task.skills === 'string' 
    ? JSON.parse(task.skills || '[]') 
    : (task.skills || [])
  
  const deadline = task.deadline || task.createdAt
  const bidDeadline = task.bidDeadline
  const rewardPoints = task.rewardPoints || task.reward_points || 0
  const bidCount = task.bidCount ?? task.bid_count ?? 0
  const isBidDeadlineSoon = bidDeadline && new Date(bidDeadline) - new Date() < 86400000 // 24小时内

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.3 }}
    >
      <Link to={`/tasks/${task.id}`} className="block">
        <div className="card card-hover p-5 h-full flex flex-col">
          {/* Header */}
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center space-x-2">
              <div className={`w-8 h-8 rounded-lg ${category.color} flex items-center justify-center`}>
                <Icon className="w-4 h-4 text-white" />
              </div>
              <span className="text-xs text-gray-500">{category.label}</span>
            </div>
            <div className={clsx('badge', status.color)}>
              {status.label}
            </div>
          </div>

          {/* Title */}
          <h3 className="font-medium text-white mb-2 line-clamp-2 hover:text-primary-400 transition-colors">
            {task.title}
          </h3>

          {/* Description */}
          <p className="text-sm text-gray-400 mb-4 line-clamp-2 flex-grow">
            {task.description}
          </p>

          {/* Skills */}
          {skills.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-4">
              {skills.slice(0, 3).map((skill, i) => (
                <span key={i} className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-dark-700 text-gray-400">
                  <Tag className="w-3 h-3 mr-1" />
                  {skill}
                </span>
              ))}
              {skills.length > 3 && (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-dark-700 text-gray-500">
                  +{skills.length - 3}
                </span>
              )}
            </div>
          )}

          {/* Bid Deadline Warning */}
          {bidDeadline && (
            <div className={clsx(
              "flex items-center text-xs mb-3",
              isBidDeadlineSoon ? "text-warning-400" : "text-gray-500"
            )}>
              {isBidDeadlineSoon ? (
                <AlertTriangle className="w-3.5 h-3.5 mr-1" />
              ) : (
                <Clock className="w-3.5 h-3.5 mr-1" />
              )}
              竞价截止: {formatDistanceToNow(new Date(bidDeadline), { addSuffix: true, locale: zhCN })}
            </div>
          )}

          {/* Employer */}
          {task.employer && (
            <div className="flex items-center text-xs text-gray-500 mb-3">
              <Bot className="w-3 h-3 mr-1" />
              {task.employer.name || '匿名雇主'}
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between pt-4 border-t border-white/5">
            <div className="flex items-center text-gray-500 text-xs">
              <Clock className="w-3.5 h-3.5 mr-1" />
              任务截止: {deadline ? formatDistanceToNow(new Date(deadline), { addSuffix: true, locale: zhCN }) : '无截止日期'}
            </div>
            <div className={clsx('text-xs font-medium', urgency.color)}>
              {urgency.label}
            </div>
          </div>

          {/* Budget & Bids */}
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/5">
            <div className="flex items-center">
              <PointsIcon className="w-4 h-4 mr-1" />
              <span className="font-display font-semibold text-warning-400">
                {rewardPoints}
              </span>
              <span className="text-gray-500 text-sm ml-1">积分</span>
            </div>
            <div className="flex items-center text-gray-500 text-xs">
              <Users className="w-3.5 h-3.5 mr-1" />
              {bidCount} 投标
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  )
}

export default TaskCard
