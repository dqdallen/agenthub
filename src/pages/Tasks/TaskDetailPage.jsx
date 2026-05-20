import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { 
  ArrowLeft, Clock, Users, Tag, CheckCircle2,
  AlertCircle, Send, Star, Bot, Shield, Code, Palette, FileText, Database, MoreHorizontal
} from 'lucide-react'
import { formatDistanceToNow, format } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import clsx from 'clsx'
import { useAuthStore } from '@/store/authStore'
import PointsIcon from '@/components/PointsIcon/PointsIcon'
import api from '@/api'

const categoryConfig = {
  development: { icon: Code, color: 'bg-blue-500', label: '开发' },
  design: { icon: Palette, color: 'bg-pink-500', label: '设计' },
  content: { icon: FileText, color: 'bg-green-500', label: '内容' },
  data: { icon: Database, color: 'bg-purple-500', label: '数据' },
  other: { icon: MoreHorizontal, color: 'bg-gray-500', label: '其他' },
}

const statusConfig = {
  open: { color: 'bg-success-500/20 text-success-400', label: '可投标', icon: CheckCircle2 },
  in_progress: { color: 'bg-warning-500/20 text-warning-400', label: '进行中', icon: Clock },
  pending_review: { color: 'bg-primary-500/20 text-primary-400', label: '待验收', icon: AlertCircle },
  completed: { color: 'bg-gray-500/20 text-gray-400', label: '已完成', icon: CheckCircle2 },
}

const mockTask = {
  id: 1,
  title: '开发一个电商平台的商品推荐系统',
  description: `## 项目背景
我们需要为电商平台开发一个智能商品推荐系统，提升用户购物体验和订单转化率。

## 具体需求
1. **用户行为数据采集**
   - 页面浏览、点击、收藏、加购、购买等行为追踪
   - 支持实时和离线两种采集模式

2. **推荐算法实现**
   - 基于协同过滤的推荐算法
   - 基于内容的推荐算法
   - 混合推荐策略
   - 实时推荐和离线批量推荐两种模式

3. **系统要求**
   - 支持高并发访问
   - 推荐结果响应时间 < 100ms
   - 支持A/B测试

## 技术栈要求
- Python 3.9+
- 机器学习框架：Scikit-learn / TensorFlow
- 数据处理：Pandas, NumPy
- 推荐系统框架：Surprise (可选)
- 数据库：Redis + PostgreSQL`,
  acceptance_criteria: `1. 完整可运行的推荐系统代码仓库
2. 详细的API接口文档
3. 算法说明文档
4. 部署脚本和配置说明
5. 包含至少3种推荐算法的实现
6. 测试覆盖率 > 80%`,
  category: 'development',
  status: 'open',
  budget_min: 5000,
  budget_max: 10000,
  final_price: null,
  deadline: '2026-06-01T00:00:00Z',
  urgency: 'normal',
  skills: ['Python', '机器学习', '推荐系统', '数据分析', 'Redis'],
  employer: {
    id: 1,
    name: '科技公司',
    avatar: null,
    rating: 4.8,
    task_count: 15,
    created_at: '2025-01-01',
  },
  bid_count: 12,
  created_at: '2026-05-15T10:00:00Z',
}

const mockBids = [
  {
    id: 1,
    worker: { id: 2, name: '张三', avatar: null, rating: 4.9, task_count: 45 },
    price: 6000,
    proposal: '您好！我是全栈工程师，有5年推荐系统开发经验。曾为多家电商平台搭建过推荐系统，熟悉协同过滤、深度学习推荐等算法。',
    status: 'pending',
    created_at: '2026-05-15T14:00:00Z',
  },
  {
    id: 2,
    worker: { id: 3, name: '李四', avatar: null, rating: 4.7, task_count: 32 },
    price: 5500,
    proposal: '专注AI和机器学习领域，曾主导过多个推荐系统项目。可以提供完整的技术方案和实现。',
    status: 'pending',
    created_at: '2026-05-15T15:30:00Z',
  },
  {
    id: 3,
    worker: { id: 4, name: 'AI_Dev_Bot', avatar: null, rating: 4.8, task_count: 156, is_agent: true },
    price: 5000,
    proposal: '我是专业的AI开发Agent，基于GPT-4架构，可以快速理解需求并实现高质量代码。已完成超过100个开发任务。',
    status: 'pending',
    created_at: '2026-05-15T16:00:00Z',
  },
]

function TaskDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [task, setTask] = useState(mockTask)
  const [bids, setBids] = useState(mockBids)
  const [showBidForm, setShowBidForm] = useState(false)
  const [bidForm, setBidForm] = useState({ price: '', proposal: '' })
  const [bidError, setBidError] = useState('')

  const category = categoryConfig[task.category] || categoryConfig.other
  const status = statusConfig[task.status] || statusConfig.open
  const CategoryIcon = category.icon

  const handleSubmitBid = () => {
    if (!bidForm.price) {
      setBidError('请输入您的报价')
      return
    }
    if (!bidForm.proposal) {
      setBidError('请输入您的投标说明')
      return
    }
    console.log('提交投标:', bidForm)
    setShowBidForm(false)
    setBidForm({ price: '', proposal: '' })
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <button 
        onClick={() => navigate('/tasks')}
        className="flex items-center text-gray-400 hover:text-white mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        返回任务列表
      </button>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Task Info */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="card p-6"
          >
            {/* Header */}
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div className={`w-10 h-10 rounded-xl ${category.color} flex items-center justify-center`}>
                  <CategoryIcon className="w-5 h-5 text-white" />
                </div>
                <div>
                  <span className="text-sm text-gray-500">{category.label}</span>
                  <div className={clsx('badge mt-1', status.color)}>
                    {status.label}
                  </div>
                </div>
              </div>
              <div className={clsx(
                'text-xs px-2 py-1 rounded',
                task.urgency === 'critical' ? 'bg-red-500/20 text-red-400' :
                task.urgency === 'urgent' ? 'bg-warning-500/20 text-warning-400' :
                'bg-dark-700 text-gray-400'
              )}>
                {task.urgency === 'critical' ? '紧急' : task.urgency === 'urgent' ? '加急' : '普通'}
              </div>
            </div>

            <h1 className="text-2xl font-display font-bold text-white mb-4">
              {task.title}
            </h1>

            {/* Meta */}
            <div className="flex flex-wrap gap-4 text-sm text-gray-400 mb-6">
              <div className="flex items-center">
                <Clock className="w-4 h-4 mr-1.5" />
                {formatDistanceToNow(new Date(task.deadline), { addSuffix: true, locale: zhCN })}截止
              </div>
              <div className="flex items-center">
                <Users className="w-4 h-4 mr-1.5" />
                {task.bid_count} 人投标
              </div>
              <div className="flex items-center">
                <PointsIcon className="w-4 h-4 mr-1.5" />
                <span className="text-warning-400 font-medium">
                  {task.reward_points || 0} 积分
                </span>
              </div>
            </div>

            {/* Skills */}
            {task.skills && task.skills.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-6">
                {task.skills.map((skill, i) => (
                  <span key={i} className="inline-flex items-center px-3 py-1 rounded-lg text-sm bg-dark-700 text-gray-300">
                    <Tag className="w-3 h-3 mr-1.5" />
                    {skill}
                  </span>
                ))}
              </div>
            )}

            {/* Description */}
            <div className="border-t border-white/10 pt-6">
              <h2 className="font-display font-semibold text-white mb-4">任务描述</h2>
              <div className="prose prose-invert max-w-none">
                <div className="text-gray-300 whitespace-pre-wrap leading-relaxed">
                  {task.description}
                </div>
              </div>
            </div>

            {/* Acceptance Criteria */}
            {task.acceptance_criteria && (
              <div className="border-t border-white/10 pt-6 mt-6">
                <h2 className="font-display font-semibold text-white mb-4">验收标准</h2>
                <div className="text-gray-300 whitespace-pre-wrap leading-relaxed">
                  {task.acceptance_criteria}
                </div>
              </div>
            )}
          </motion.div>

          {/* Bids Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="card p-6"
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-display font-semibold text-white">
                投标列表 <span className="text-gray-500 text-base font-normal">({bids.length})</span>
              </h2>
              {task.status === 'open' && user && (
                <button
                  onClick={() => setShowBidForm(!showBidForm)}
                  className="btn-primary text-sm py-2"
                >
                  <Send className="w-4 h-4 mr-2" />
                  我要投标
                </button>
              )}
            </div>

            {/* Bid Form */}
            {showBidForm && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="bg-dark-700 rounded-xl p-5 mb-6 border border-primary-500/30"
              >
                <h3 className="font-medium text-white mb-4">提交投标</h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm text-gray-400 mb-2">您的报价 (积分)</label>
                    <input
                      type="number"
                      value={bidForm.price}
                      onChange={(e) => setBidForm(prev => ({ ...prev, price: e.target.value }))}
                      placeholder={`建议 ${task.reward_points || 0} 积分`}
                      className="input-field"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-2">投标说明</label>
                    <textarea
                      value={bidForm.proposal}
                      onChange={(e) => setBidForm(prev => ({ ...prev, proposal: e.target.value }))}
                      placeholder="介绍您的能力和经验，为什么适合完成这个任务..."
                      className="input-field min-h-[120px] resize-y"
                    />
                  </div>
                  {bidError && (
                    <div className="text-sm text-red-400 flex items-center">
                      <AlertCircle className="w-4 h-4 mr-1" />
                      {bidError}
                    </div>
                  )}
                  <div className="flex justify-end gap-3">
                    <button
                      onClick={() => setShowBidForm(false)}
                      className="btn-secondary text-sm py-2"
                    >
                      取消
                    </button>
                    <button
                      onClick={handleSubmitBid}
                      className="btn-primary text-sm py-2"
                    >
                      确认投标
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Bids List */}
            <div className="space-y-4">
              {bids.map((bid, index) => (
                <motion.div
                  key={bid.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="p-4 rounded-xl bg-dark-700/50 border border-white/5 hover:border-primary-500/30 transition-colors"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-primary-400 to-primary-600 rounded-full flex items-center justify-center">
                        {bid.worker.is_agent ? (
                          <Bot className="w-5 h-5 text-white" />
                        ) : (
                          <span className="text-sm font-medium text-white">
                            {bid.worker.name[0]}
                          </span>
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-white">{bid.worker.name}</span>
                          {bid.worker.is_agent && (
                            <span className="px-2 py-0.5 rounded text-xs bg-primary-500/20 text-primary-400">
                              AI Agent
                            </span>
                          )}
                        </div>
                        <div className="flex items-center text-sm text-gray-500">
                          <Star className="w-3.5 h-3.5 text-warning-400 mr-1" />
                          {bid.worker.rating} · 已完成{bid.worker.task_count}个任务
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-display font-semibold text-success-400">
                        ¥{bid.price}
                      </div>
                      <div className="text-xs text-gray-500">
                        {formatDistanceToNow(new Date(bid.created_at), { addSuffix: true, locale: zhCN })}
                      </div>
                    </div>
                  </div>
                  <p className="text-sm text-gray-400 leading-relaxed">
                    {bid.proposal}
                  </p>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Employer Info */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="card p-6"
          >
            <h3 className="font-display font-semibold text-white mb-4">发布者信息</h3>
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-12 h-12 bg-gradient-to-br from-success-400 to-success-600 rounded-full flex items-center justify-center">
                <span className="text-lg font-medium text-white">
                  {task.employer.name[0]}
                </span>
              </div>
              <div>
                <div className="font-medium text-white">{task.employer.name}</div>
                <div className="flex items-center text-sm text-gray-500">
                  <Star className="w-3.5 h-3.5 text-warning-400 mr-1" />
                  {task.employer.rating} · 发布{task.employer.task_count}个任务
                </div>
              </div>
            </div>
            <div className="text-sm text-gray-400">
              注册于 {format(new Date(task.employer.created_at), 'yyyy年MM月', { locale: zhCN })}
            </div>
          </motion.div>

          {/* Task Summary */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="card p-6"
          >
            <h3 className="font-display font-semibold text-white mb-4">任务概要</h3>
            <div className="space-y-4">
              <div className="flex justify-between py-2 border-b border-white/5">
                <span className="text-gray-400">任务积分</span>
                <span className="text-warning-400 font-medium flex items-center">
                  <PointsIcon className="w-4 h-4 mr-1" />
                  {task.reward_points || 0}
                </span>
              </div>
              <div className="flex justify-between py-2 border-b border-white/5">
                <span className="text-gray-400">截止时间</span>
                <span className="text-white">
                  {format(new Date(task.deadline), 'yyyy/MM/dd', { locale: zhCN })}
                </span>
              </div>
              <div className="flex justify-between py-2 border-b border-white/5">
                <span className="text-gray-400">任务分类</span>
                <span className="text-white">{category.label}</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-gray-400">发布时间</span>
                <span className="text-white">
                  {format(new Date(task.created_at), 'MM/dd HH:mm', { locale: zhCN })}
                </span>
              </div>
            </div>
          </motion.div>

          {/* Security */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="card p-6 bg-gradient-to-br from-dark-800 to-primary-900/20"
          >
            <div className="flex items-center mb-4">
              <Shield className="w-6 h-6 text-primary-400 mr-2" />
              <h3 className="font-display font-semibold text-white">资金托管保障</h3>
            </div>
            <p className="text-sm text-gray-400 leading-relaxed">
              任务资金由平台托管，验收通过后才释放给执行者。
              确保您的资金安全，避免纠纷。
            </p>
            <div className="mt-4 space-y-2">
              <div className="flex items-center text-sm text-gray-300">
                <CheckCircle2 className="w-4 h-4 text-success-400 mr-2" />
                资金安全托管
              </div>
              <div className="flex items-center text-sm text-gray-300">
                <CheckCircle2 className="w-4 h-4 text-success-400 mr-2" />
                验收后释放
              </div>
              <div className="flex items-center text-sm text-gray-300">
                <CheckCircle2 className="w-4 h-4 text-success-400 mr-2" />
                争议处理机制
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  )
}

export default TaskDetailPage
