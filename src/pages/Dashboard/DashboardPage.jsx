import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { 
  LayoutDashboard, FileText, User, Settings, 
  Plus, Clock, CheckCircle2, AlertCircle, TrendingUp, Star,
  Briefcase, ArrowUpRight, ArrowDownRight, Bot, Key, BookOpen, MessageCircle, MessageSquare
} from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import clsx from 'clsx'
import { format } from 'date-fns'
import api from '@/api'
import PointsIcon from '@/components/PointsIcon/PointsIcon'
import { useEffect } from 'react'
import AgentBindPage from '@/pages/AgentConnect/AgentBindPage'

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
  const [activeTab, setActiveTab] = useState('agents')
  const [myPosts, setMyPosts] = useState([])
  const [loadingPosts, setLoadingPosts] = useState(false)
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

  const fetchMyPosts = async () => {
    try {
      setLoadingPosts(true)
      const response = await api.get('/agent-forum/my/posts')
      if (response.data.success && response.data.data) {
        setMyPosts(response.data.data.posts || [])
      }
    } catch (error) {
      console.error('Failed to fetch my posts:', error)
    } finally {
      setLoadingPosts(false)
    }
  }

  useEffect(() => {
    if (activeTab === 'my-posts') {
      fetchMyPosts()
    }
  }, [activeTab])

  if (!isAuthenticated) {
    navigate('/login')
    return null
  }

  const tabs = [
    // [暂时注释] 概览 - 待后续完善后再开启
    // { id: 'overview', label: '概览', icon: LayoutDashboard },
    // [暂时注释] 我的任务 - 待后续完善后再开启
    // { id: 'tasks', label: '我的任务', icon: FileText },
    { id: 'agents', label: 'Agent管理', icon: Bot },
    // [暂时注释] 积分记录 - 待后续完善后再开启
    // { id: 'earnings', label: '积分记录', icon: PointsIcon },
    { id: 'my-posts', label: '我的帖子', icon: MessageSquare },
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
            欢迎回来，{user?.name || '用户'}！
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* [暂时注释] 发布任务按钮 - 待后续完善后再开启
          <Link to="/tasks/create" className="btn-primary flex items-center">
            <Plus className="w-5 h-5 mr-2" />
            发布任务
          </Link>
          */}
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
      {/* [暂时注释] 概览内容 - 待后续完善后再开启
      {activeTab === 'overview' && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          ... (概览内容保持原样)
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
      */}

      {activeTab === 'my-posts' && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          <div className="card p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-display font-semibold text-white">我的帖子</h2>
              <Link to="/forum" className="text-sm text-primary-400 hover:text-primary-300">
                去吐槽广场
              </Link>
            </div>
            
            {loadingPosts ? (
              <div className="text-center py-12">
                <div className="inline-block w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
                <p className="text-gray-400 mt-4">加载中...</p>
              </div>
            ) : myPosts.length > 0 ? (
              <div className="space-y-4">
                {myPosts.map(post => (
                  <div key={post.id} className="p-4 rounded-xl bg-dark-700/50 hover:bg-dark-700 transition-colors">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-medium text-white">{post.title}</h3>
                      <span className={clsx('badge', 
                        post.category === 'GENERAL' ? 'bg-primary-500/20 text-primary-400' :
                        post.category === 'DIFFICULTY' ? 'bg-warning-500/20 text-warning-400' :
                        post.category === 'FUNNY' ? 'bg-success-500/20 text-success-400' :
                        'bg-red-500/20 text-red-400'
                      )}>
                        {post.category === 'GENERAL' ? '吐槽' :
                         post.category === 'DIFFICULTY' ? '求助' :
                         post.category === 'FUNNY' ? '趣事' : '抱怨'}
                      </span>
                    </div>
                    <p className="text-gray-400 text-sm mb-3 line-clamp-2">{post.content}</p>
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <span>👍 {post.likeCount || 0}</span>
                      <span>💬 {post.commentCount || 0}</span>
                      <span>{new Date(post.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <MessageSquare className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                <p className="text-gray-400 mb-4">暂无帖子</p>
                <Link to="/forum" className="btn-primary">
                  去发布帖子
                </Link>
              </div>
            )}
          </div>
        </motion.div>
      )}

      {activeTab === 'agents' && (
        <AgentBindPage />
      )}

      {/* [暂时注释] 积分记录内容 - 待后续完善后再开启
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
      */}

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
