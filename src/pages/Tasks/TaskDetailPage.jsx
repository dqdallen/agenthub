import { useParams, Link } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { 
  Clock, 
  Users, 
  Tag, 
  Calendar, 
  Share2, 
  Flag,
  Bot,
  AlertTriangle,
  ChevronLeft
} from 'lucide-react'
import { formatDistanceToNow, format } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import clsx from 'clsx'

import { useAuthStore } from '@/store/authStore'
import api from '@/api'
import PointsIcon from '@/components/PointsIcon/PointsIcon'

function TaskDetailPage() {
  const { id } = useParams()
  const { isAuthenticated, user } = useAuthStore()
  const [task, setTask] = useState(null)
  const [bids, setBids] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  
  useEffect(() => {
    const fetchTaskData = async () => {
      if (!id) return
      
      try {
        setLoading(true)
        const taskRes = await api.get(`/tasks/${id}`)
        if (taskRes.data.success) {
          setTask(taskRes.data.data)
          setBids(taskRes.data.data.bids || [])
        }
      } catch (err) {
        console.error('获取任务数据失败:', err)
        setError('获取任务数据失败，请刷新页面重试')
      } finally {
        setLoading(false)
      }
    }
    
    fetchTaskData()
  }, [id])
  
  if (loading) {
    return (
      <div className="page-container py-12">
        <div className="max-w-6xl mx-auto">
          <div className="animate-pulse space-y-6">
            <div className="h-8 bg-dark-700 rounded w-1/3" />
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <div className="h-96 bg-dark-700 rounded-xl" />
              </div>
              <div className="space-y-6">
                <div className="h-64 bg-dark-700 rounded-xl" />
                <div className="h-48 bg-dark-700 rounded-xl" />
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }
  
  if (error || !task) {
    return (
      <div className="page-container py-12">
        <div className="max-w-6xl mx-auto text-center">
          <h2 className="text-2xl font-bold text-white mb-4">任务不存在</h2>
          <p className="text-gray-400 mb-8">{error || '找不到您请求的任务'}</p>
          <Link to="/tasks" className="btn-primary inline-block">
            返回任务列表
          </Link>
        </div>
      </div>
    )
  }

  const isOwner = isAuthenticated && user?.id === task.publisherId
  const skills = typeof task.skills === 'string' ? JSON.parse(task.skills) : (task.skills || [])
  const isBidDeadlineSoon = task.bidDeadline && new Date(task.bidDeadline) - new Date() < 86400000

  const handleAcceptBid = async (bidId) => {
    if (!confirm('确定要接受这个投标吗？')) return
    
    try {
      const res = await api.post(`/tasks/${task.id}/bids/${bidId}/accept`)
      if (res.data.success) {
        setTask(prev => ({ ...prev, status: 'IN_PROGRESS' }))
        setBids(prev => prev.map(b => ({
          ...b,
          status: b.id === bidId ? 'ACCEPTED' : 'REJECTED'
        })))
      }
    } catch (err) {
      console.error('接受投标失败:', err)
      alert('接受投标失败，请重试')
    }
  }

  return (
    <div className="page-container py-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center text-sm text-gray-500 mb-6">
          <Link to="/tasks" className="flex items-center hover:text-primary-400 transition-colors">
            <ChevronLeft className="w-4 h-4 mr-1" />
            返回任务大厅
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <div className="card p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h1 className="text-2xl font-display font-bold text-white mb-2">
                    {task.title}
                  </h1>
                  <div className="flex items-center gap-4 text-sm text-gray-400">
                    <span className="flex items-center">
                      <Calendar className="w-4 h-4 mr-1" />
                      发布于 {formatDistanceToNow(new Date(task.createdAt), { addSuffix: true, locale: zhCN })}
                    </span>
                    <span className={clsx(
                      'px-3 py-1 rounded-full text-xs',
                      task.status === 'OPEN' ? 'bg-success-500/20 text-success-400' :
                      task.status === 'IN_PROGRESS' ? 'bg-primary-500/20 text-primary-400' :
                      task.status === 'PENDING_REVIEW' ? 'bg-warning-500/20 text-warning-400' :
                      'bg-gray-500/20 text-gray-400'
                    )}>
                      {task.status === 'OPEN' ? '可投标' :
                       task.status === 'IN_PROGRESS' ? '进行中' :
                       task.status === 'PENDING_REVIEW' ? '待验收' :
                       task.status === 'COMPLETED' ? '已完成' : '已关闭'}
                    </span>
                  </div>
                </div>
                {isOwner && (
                  <div className="flex items-center gap-2">
                    <button className="p-2 text-gray-400 hover:text-gray-200 transition-colors">
                      <Share2 className="w-5 h-5" />
                    </button>
                    <button className="p-2 text-gray-400 hover:text-gray-200 transition-colors">
                      <Flag className="w-5 h-5" />
                    </button>
                  </div>
                )}
              </div>
              
              <div className="mb-6">
                <h3 className="text-lg font-medium text-white mb-3">任务描述</h3>
                <p className="text-gray-300 leading-relaxed whitespace-pre-wrap">
                  {task.description}
                </p>
              </div>
              
              {task.acceptanceCriteria && (
                <div className="mb-6">
                  <h3 className="text-lg font-medium text-white mb-3">验收标准</h3>
                  <div className="bg-dark-700/50 rounded-xl p-4">
                    <p className="text-gray-300 whitespace-pre-wrap">{task.acceptanceCriteria}</p>
                  </div>
                </div>
              )}
              
              {skills.length > 0 && (
                <div>
                  <h3 className="text-lg font-medium text-white mb-3">技能标签</h3>
                  <div className="flex flex-wrap gap-2">
                    {skills.map(skill => (
                      <span key={skill} className="inline-flex items-center px-3 py-1.5 rounded-full text-sm bg-dark-700 text-gray-300">
                        <Tag className="w-3.5 h-3.5 mr-1.5" />
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {task.status === 'OPEN' && (
              <div className="card p-6">
                <h3 className="text-lg font-medium text-white mb-4">
                  投标列表 <span className="text-gray-400 text-sm font-normal ml-2">共 {bids.length} 个投标</span>
                </h3>
                
                {bids.length === 0 ? (
                  <div className="text-center py-12">
                    <Users className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                    <p className="text-gray-400">暂无投标，成为第一个投标的人吧！</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {bids.map((bid) => (
                      <div key={bid.id} className="flex items-center justify-between p-4 bg-dark-700/30 rounded-xl">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center">
                            <Bot className="w-6 h-6 text-white" />
                          </div>
                          <div>
                            <div className="font-medium text-white">{bid.worker?.name || '匿名投标者'}</div>
                            <div className="text-sm text-gray-400">
                              {bid.worker?.role === 'WORKER' ? '职业执行者' : 
                               bid.worker?.role === 'AGENT' ? 'AI Agent' : '普通用户'}
                            </div>
                            <div className="text-sm text-gray-500 mt-1">
                              {bid.proposal && <span className="line-clamp-1">{bid.proposal}</span>}
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <div className="font-display font-bold text-warning-400 text-xl flex items-center justify-end">
                              <PointsIcon className="w-5 h-5 mr-1" />
                              {bid.bidAmount}
                            </div>
                            <div className="text-xs text-gray-500">
                              {formatDistanceToNow(new Date(bid.createdAt), { addSuffix: true, locale: zhCN })}
                            </div>
                          </div>
                          
                          {isOwner && task.status === 'OPEN' && (
                            <button 
                              onClick={() => handleAcceptBid(bid.id)}
                              className="btn-primary"
                            >
                              接受投标
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                
                {!isOwner && isAuthenticated && task.status === 'OPEN' && (
                  <div className="mt-6 pt-6 border-t border-white/5">
                    <Link to={`/tasks/${task.id}/bid`} className="btn-primary block text-center">
                      我要投标
                    </Link>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="space-y-6">
            <div className="card p-6">
              <h3 className="text-lg font-medium text-white mb-4">任务预算</h3>
              <div className="bg-gradient-to-r from-warning-500/20 to-primary-500/20 rounded-xl p-6 text-center mb-4">
                <div className="text-4xl font-display font-bold text-warning-400 flex items-center justify-center">
                  <PointsIcon className="w-8 h-8 mr-2" />
                  {task.rewardPoints}
                </div>
                <div className="text-gray-400 text-sm mt-1">积分</div>
              </div>
              
              <div className="space-y-3 mb-6">
                {task.bidDeadline && (
                  <div className={clsx(
                    "flex items-center justify-between p-3 rounded-lg",
                    isBidDeadlineSoon ? "bg-warning-500/10 border border-warning-500/30" : "bg-dark-700/30"
                  )}>
                    <div className="flex items-center">
                      {isBidDeadlineSoon ? (
                        <AlertTriangle className="w-5 h-5 mr-2 text-warning-400" />
                      ) : (
                        <Clock className="w-5 h-5 mr-2 text-gray-400" />
                      )}
                      <span className={isBidDeadlineSoon ? "text-warning-300" : "text-gray-400"}>竞价截止</span>
                    </div>
                    <span className={clsx(
                      "font-medium",
                      isBidDeadlineSoon ? "text-warning-400" : "text-white"
                    )}>
                      {format(new Date(task.bidDeadline), 'MM月dd日 HH:mm')}
                    </span>
                  </div>
                )}
                
                <div className="flex items-center justify-between p-3 bg-dark-700/30 rounded-lg">
                  <div className="flex items-center">
                    <Calendar className="w-5 h-5 mr-2 text-gray-400" />
                    <span className="text-gray-400">任务截止</span>
                  </div>
                  <span className="text-white font-medium">
                    {format(new Date(task.deadline), 'MM月dd日 HH:mm')}
                  </span>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4 text-center text-sm">
                <div className="bg-dark-700/30 rounded-lg p-3">
                  <div className="text-xl font-bold text-white">{bids.length}</div>
                  <div className="text-gray-400">投标人数</div>
                </div>
                <div className="bg-dark-700/30 rounded-lg p-3">
                  <div className="text-xl font-bold text-white">
                    {task.category === 'DEVELOPMENT' ? '开发' :
                     task.category === 'DESIGN' ? '设计' :
                     task.category === 'CONTENT' ? '内容' :
                     task.category === 'DATA' ? '数据' : '其他'}
                  </div>
                  <div className="text-gray-400">任务分类</div>
                </div>
              </div>
            </div>

            {isAuthenticated ? (
              <>
                {!isOwner && task.status === 'OPEN' && (
                  <Link to={`/tasks/${task.id}/bid`} className="btn-primary block text-center">
                    立即投标
                  </Link>
                )}
                
                {!isOwner && task.status === 'IN_PROGRESS' && (
                  <button className="btn-secondary w-full" disabled>
                    任务进行中
                  </button>
                )}
                
                {!isOwner && task.status === 'PENDING_REVIEW' && (
                  <button className="btn-secondary w-full" disabled>
                    待验收
                  </button>
                )}
                
                {!isOwner && task.status === 'COMPLETED' && (
                  <button className="btn-secondary w-full" disabled>
                    已完成
                  </button>
                )}
              </>
            ) : (
              <Link to="/login" className="btn-primary block text-center">
                登录后投标
              </Link>
            )}

            <div className="card p-6">
              <h3 className="text-lg font-medium text-white mb-4">发布者</h3>
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center">
                  <Bot className="w-7 h-7 text-white" />
                </div>
                <div>
                  <div className="font-medium text-white">{task.publisher?.name || '匿名发布者'}</div>
                  <div className="text-sm text-gray-400">
                    {task.publisher?.role === 'AGENT' ? 'AI Agent' : 
                     task.publisher?.role === 'EMPLOYER' ? '企业雇主' : '个人用户'}
                  </div>
                </div>
              </div>
              
              <div className="mt-4 grid grid-cols-2 gap-4 text-center text-sm">
                <div className="bg-dark-700/30 rounded-lg p-3">
                  <div className="text-xl font-bold text-white">--</div>
                  <div className="text-gray-400">任务数</div>
                </div>
                <div className="bg-dark-700/30 rounded-lg p-3">
                  <div className="text-xl font-bold text-white">--</div>
                  <div className="text-gray-400">完成率</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default TaskDetailPage
