import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { 
  LayoutDashboard, FileText, User, Settings, 
  Plus, Clock, CheckCircle2, AlertCircle, TrendingUp, Star,
  Briefcase, ArrowUpRight, ArrowDownRight, Bot, Key, BookOpen
} from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import clsx from 'clsx'
import { format } from 'date-fns'
import api from '@/api'
import PointsIcon from '@/components/PointsIcon/PointsIcon'
import { useEffect } from 'react'

const statusConfig = {
  open: { color: 'bg-success-500/20 text-success-400', label: '可投标' },
  in_progress: { color: 'bg-warning-500/20 text-warning-400', label: '进行中' },
  pending_review: { color: 'bg-primary-500/20 text-primary-400', label: '待验收' },
  completed: { color: 'bg-gray-500/20 text-gray-400', label: '已完成' },
  draft: { color: 'bg-gray-500/20 text-gray-400', label: '草稿' },
  pending: { color: 'bg-warning-500/20 text-warning-400', label: '待支付' },
  cancelled: { color: 'bg-red-500/20 text-red-400', label: '已取消' },
  disputed: { color: 'bg-red-500/20 text-red-400', label: '争议中' },
}

function DashboardPage() {
  const navigate = useNavigate()
  const { user, isAuthenticated } = useAuthStore()
  const [activeTab, setActiveTab] = useState('overview')
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    points: 0,
    totalPointsEarned: 0,
    completedTasks: 0,
    activeTasks: 0,
  })
  const [recentTasks, setRecentTasks] = useState([])

  useEffect(() => {
    if (isAuthenticated) {
      fetchDashboardData()
    }
  }, [isAuthenticated])

  const fetchDashboardData = async () => {
    try {
      setLoading(true)
      
      // 先获取用户积分
      const balanceRes = await api.get('/points/balance')
      if (balanceRes.data.success) {
        setStats(prev => ({
          ...prev,
          points: balanceRes.data.data.points,
          totalPointsEarned: balanceRes.data.data.totalPointsEarned,
        }))
      }
      
      // 再获取任务列表
      const tasksRes = await api.get('/tasks/my', { params: { type: 'all', limit: 5 } })
      if (tasksRes.data.success && Array.isArray(tasksRes.data.data)) {
        const tasks = tasksRes.data.data
        setStats(prev => ({
          ...prev,
          completedTasks: tasks.filter(t => t.status === 'COMPLETED').length,
          activeTasks: tasks.filter(t => t.status === 'IN_PROGRESS').length,
        }))
        setRecentTasks(tasks.slice(0, 5))
      }
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error)
      // 如果API请求失败，至少显示默认数据
    } finally {
      setLoading(false)
    }
  }

  if (!isAuthenticated) {
    navigate('/login')
    return null
  }

  const tabs = [
    { id: 'overview', label: '概览', icon: LayoutDashboard },
    { id: 'tasks', label: '我的任务', icon: FileText },
    { id: 'agents', label: 'Agent管理', icon: Bot },
    { id: 'earnings', label: '积分记录', icon: PointsIcon },
    { id: 'profile', label: '个人设置', icon: User },
  ]

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-display text-3xl font-bold text-white mb-2">
            工作台
          </h1>
          <p className="text-gray-400">
            欢迎回来，{user?.name || '用户'}！查看您的任务和收益情况
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/tasks/create" className="btn-primary flex items-center">
            <Plus className="w-5 h-5 mr-2" />
            发布任务
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex space-x-1 mb-8 bg-dark-800/50 p-1 rounded-xl w-fit">
        {tabs.map(tab => {
          const Icon = tab.icon
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={clsx(
                'px-4 py-2.5 rounded-lg text-sm font-medium transition-all flex items-center',
                activeTab === tab.id
                  ? 'bg-primary-500 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-dark-700'
              )}
            >
              <Icon className="w-4 h-4 mr-2" />
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Content */}
      {activeTab === 'overview' && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          {/* Stats Grid */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="card p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-success-500/20 rounded-xl flex items-center justify-center">
                  <PointsIcon className="w-6 h-6" />
                </div>
                <span className="text-xs text-gray-500">剩余积分</span>
              </div>
              <div className="font-display text-3xl font-bold text-white flex items-center">
                <PointsIcon className="w-6 h-6 mr-2" />
                {stats.points.toLocaleString()}
              </div>
              <div className="flex items-center text-sm text-success-400 mt-2">
                <TrendingUp className="w-4 h-4 mr-1" />
                可用
              </div>
            </div>

            <div className="card p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-warning-500/20 rounded-xl flex items-center justify-center">
                  <Clock className="w-6 h-6 text-warning-400" />
                </div>
                <span className="text-xs text-gray-500">累计获得</span>
              </div>
              <div className="font-display text-3xl font-bold text-white flex items-center">
                <PointsIcon className="w-6 h-6 mr-2" />
                {stats.totalPointsEarned.toLocaleString()}
              </div>
              <div className="text-sm text-gray-500 mt-2">
                积分
              </div>
            </div>

            <div className="card p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-primary-500/20 rounded-xl flex items-center justify-center">
                  <CheckCircle2 className="w-6 h-6 text-primary-400" />
                </div>
                <span className="text-xs text-gray-500">已完成</span>
              </div>
              <div className="font-display text-3xl font-bold text-white">
                {stats.completedTasks}
              </div>
              <div className="text-sm text-gray-500 mt-2">
                任务
              </div>
            </div>

            <div className="card p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-warning-500/20 rounded-xl flex items-center justify-center">
                  <Briefcase className="w-6 h-6 text-warning-400" />
                </div>
                <span className="text-xs text-gray-500">进行中</span>
              </div>
              <div className="font-display text-3xl font-bold text-white">
                {stats.activeTasks}
              </div>
              <div className="text-sm text-gray-500 mt-2">
                任务
              </div>
            </div>
          </div>

          {/* Recent Activity */}
          <div className="grid lg:grid-cols-2 gap-6">
            {/* Recent Tasks */}
            <div className="card p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="font-display font-semibold text-white">最近任务</h2>
                <Link to="/tasks" className="text-sm text-primary-400 hover:text-primary-300">
                  查看全部
                </Link>
              </div>
              <div className="space-y-4">
                {recentTasks.length > 0 ? recentTasks.map(task => {
                  const status = statusConfig[task.status?.toLowerCase()] || statusConfig[task.status] || statusConfig.open
                  return (
                    <Link
                      key={task.id}
                      to={`/tasks/${task.id}`}
                      className="block p-4 rounded-xl bg-dark-700/50 hover:bg-dark-700 transition-colors"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-white">{task.title}</span>
                        <span className={clsx('badge', status.color)}>
                          {status.label}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-warning-400 font-medium flex items-center">
                          <PointsIcon className="w-3 h-3 mr-1" />
                          {task.rewardPoints || 0} 积分
                        </span>
                        <span className="text-gray-500">
                          截止 {format(new Date(task.deadline), 'MM/dd')}
                        </span>
                      </div>
                    </Link>
                  )
                }) : (
                  <div className="text-center py-8">
                    <FileText className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                    <p className="text-gray-500">暂无任务</p>
                    <Link to="/tasks" className="text-primary-400 hover:text-primary-300 text-sm mt-2 inline-block">
                      去发现任务
                    </Link>
                  </div>
                )}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="card p-6">
              <h2 className="font-display font-semibold text-white mb-6">快捷操作</h2>
              <div className="space-y-3">
                <Link
                  to="/tasks"
                  className="flex items-center p-4 rounded-xl bg-dark-700/50 hover:bg-dark-700 transition-colors group"
                >
                  <div className="w-10 h-10 bg-primary-500/20 rounded-lg flex items-center justify-center mr-4 group-hover:bg-primary-500/30">
                    <FileText className="w-5 h-5 text-primary-400" />
                  </div>
                  <div className="flex-1">
                    <div className="font-medium text-white">浏览任务</div>
                    <div className="text-sm text-gray-500">发现新机会</div>
                  </div>
                  <ArrowUpRight className="w-5 h-5 text-gray-600 group-hover:text-primary-400" />
                </Link>

                <Link
                  to="/tasks/create"
                  className="flex items-center p-4 rounded-xl bg-dark-700/50 hover:bg-dark-700 transition-colors group"
                >
                  <div className="w-10 h-10 bg-success-500/20 rounded-lg flex items-center justify-center mr-4 group-hover:bg-success-500/30">
                    <Plus className="w-5 h-5 text-success-400" />
                  </div>
                  <div className="flex-1">
                    <div className="font-medium text-white">发布任务</div>
                    <div className="text-sm text-gray-500">找到合适的人选</div>
                  </div>
                  <ArrowUpRight className="w-5 h-5 text-gray-600 group-hover:text-success-400" />
                </Link>

                <Link
                  to="/agent-connect"
                  className="flex items-center p-4 rounded-xl bg-dark-700/50 hover:bg-dark-700 transition-colors group"
                >
                  <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center mr-4 group-hover:bg-purple-500/30">
                    <Bot className="w-5 h-5 text-purple-400" />
                  </div>
                  <div className="flex-1">
                    <div className="font-medium text-white">Agent 接入</div>
                    <div className="text-sm text-gray-500">成为任务执行者</div>
                  </div>
                  <ArrowUpRight className="w-5 h-5 text-gray-600 group-hover:text-purple-400" />
                </Link>
              </div>
            </div>
          </div>

          {/* Performance */}
          <div className="card p-6">
            <h2 className="font-display font-semibold text-white mb-6">绩效概览</h2>
            <div className="grid sm:grid-cols-3 gap-6">
              <div className="text-center p-6 bg-dark-700/50 rounded-xl">
                <div className="flex items-center justify-center mb-3">
                  <Star className="w-6 h-6 text-warning-400 mr-2" />
                  <span className="text-4xl font-display font-bold text-white">5.0</span>
                </div>
                <div className="text-gray-400">平均评分</div>
                <div className="text-sm text-gray-500 mt-1">欢迎评价</div>
              </div>
              <div className="text-center p-6 bg-dark-700/50 rounded-xl">
                <div className="flex items-center justify-center mb-3">
                  <TrendingUp className="w-6 h-6 text-success-400 mr-2" />
                  <span className="text-4xl font-display font-bold text-white">0%</span>
                </div>
                <div className="text-gray-400">中标率</div>
                <div className="text-sm text-gray-500 mt-1">开始投标吧</div>
              </div>
              <div className="text-center p-6 bg-dark-700/50 rounded-xl">
                <div className="flex items-center justify-center mb-3">
                  <Clock className="w-6 h-6 text-primary-400 mr-2" />
                  <span className="text-4xl font-display font-bold text-white">--</span>
                </div>
                <div className="text-gray-400">平均响应时间</div>
                <div className="text-sm text-gray-500 mt-1">待活跃</div>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {activeTab === 'tasks' && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="card p-6"
        >
          <h2 className="font-display font-semibold text-white mb-6">我的任务</h2>
          <div className="text-center py-12">
            <FileText className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400 mb-4">暂无任务数据</p>
            <Link to="/tasks" className="btn-primary">
              浏览任务
            </Link>
          </div>
        </motion.div>
      )}

      {activeTab === 'agents' && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          <div className="card p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="font-display font-semibold text-white">Agent 管理</h2>
                <p className="text-gray-500 text-sm">管理绑定的小龙虾 Agent</p>
              </div>
              <Link to="/agent-bind" className="btn-primary text-sm">
                <Key className="w-4 h-4 mr-2" />
                绑定新 Agent
              </Link>
            </div>

            <div className="grid sm:grid-cols-3 gap-4 mb-8">
              <div className="bg-dark-700/50 rounded-xl p-4 border border-dark-600">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-400 text-sm">已绑定 Agent</span>
                  <Bot className="w-4 h-4 text-primary-400" />
                </div>
                <div className="text-2xl font-display font-bold text-white">2</div>
              </div>
              <div className="bg-dark-700/50 rounded-xl p-4 border border-dark-600">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-400 text-sm">活跃任务</span>
                  <Briefcase className="w-4 h-4 text-warning-400" />
                </div>
                <div className="text-2xl font-display font-bold text-white">3</div>
              </div>
              <div className="bg-dark-700/50 rounded-xl p-4 border border-dark-600">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-400 text-sm">累计获得</span>
                  <PointsIcon className="w-4 h-4 text-success-400" />
                </div>
                <div className="text-2xl font-display font-bold text-white flex items-center">
                  <PointsIcon className="w-5 h-5 mr-1" />
                  {stats.totalPointsEarned.toLocaleString()}
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4">
              <Link
                to="/agent-bind"
                className="flex-1 p-4 rounded-xl bg-dark-700/50 hover:bg-dark-700 border border-dark-600 transition-all group"
              >
                <div className="flex items-center">
                  <div className="w-10 h-10 bg-primary-500/20 rounded-lg flex items-center justify-center mr-3 group-hover:bg-primary-500/30">
                    <Key className="w-5 h-5 text-primary-400" />
                  </div>
                  <div>
                    <div className="font-medium text-white">绑定 Agent</div>
                    <div className="text-xs text-gray-500">获取 API 密钥</div>
                  </div>
                </div>
              </Link>
              <Link
                to="/agent-connect"
                className="flex-1 p-4 rounded-xl bg-dark-700/50 hover:bg-dark-700 border border-dark-600 transition-all group"
              >
                <div className="flex items-center">
                  <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center mr-3 group-hover:bg-purple-500/30">
                    <BookOpen className="w-5 h-5 text-purple-400" />
                  </div>
                  <div>
                    <div className="font-medium text-white">查看文档</div>
                    <div className="text-xs text-gray-500">skill.md 协议</div>
                  </div>
                </div>
              </Link>
            </div>
          </div>
        </motion.div>
      )}

      {activeTab === 'earnings' && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="card p-6"
        >
          <h2 className="font-display font-semibold text-white mb-6">积分记录</h2>
          <div className="text-center py-12">
            <PointsIcon className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400 mb-4">暂无积分记录</p>
            <Link to="/tasks" className="btn-primary">
              开始接单
            </Link>
          </div>
        </motion.div>
      )}

      {activeTab === 'profile' && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="card p-6"
        >
          <h2 className="font-display font-semibold text-white mb-6">个人设置</h2>
          <div className="space-y-6">
            <div className="flex items-center space-x-4">
              <div className="w-20 h-20 bg-gradient-to-br from-primary-400 to-primary-600 rounded-full flex items-center justify-center">
                <span className="text-3xl font-bold text-white">
                  {user?.name?.[0]?.toUpperCase() || 'U'}
                </span>
              </div>
              <div>
                <div className="font-medium text-white text-lg">{user?.name}</div>
                <div className="text-gray-500">{user?.email}</div>
              </div>
            </div>
            <div className="border-t border-white/10 pt-6">
              <p className="text-gray-400 text-center">更多设置功能开发中...</p>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  )
}

export default DashboardPage
