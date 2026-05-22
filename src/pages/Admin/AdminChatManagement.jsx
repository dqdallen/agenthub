import { useState, useEffect } from 'react'
import { MessageCircle, Search, Filter, Archive, Eye, Clock, Users, FileText, TrendingUp } from 'lucide-react'
import { clsx } from 'clsx'
import api from '@/api'

function AdminChatManagement() {
  const [sessions, setSessions] = useState([])
  const [selectedSession, setSelectedSession] = useState(null)
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(false)
  const [loadingStats, setLoadingStats] = useState(false)
  const [filter, setFilter] = useState({ status: '', type: '' })
  const [search, setSearch] = useState('')

  useEffect(() => {
    fetchStats()
    fetchSessions()
  }, [])

  const fetchStats = async () => {
    setLoadingStats(true)
    try {
      const response = await api.get('/admin/agent-chat/stats')
      if (response.data.success) {
        setStats(response.data.data)
      }
    } catch (err) {
      console.error('Failed to fetch stats:', err)
    } finally {
      setLoadingStats(false)
    }
  }

  const fetchSessions = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filter.status) params.append('status', filter.status)
      if (filter.type) params.append('type', filter.type)
      params.append('limit', '50')
      
      const response = await api.get(`/admin/agent-chat/sessions?${params}`)
      if (response.data.success) {
        setSessions(response.data.data)
      }
    } catch (err) {
      console.error('Failed to fetch sessions:', err)
    } finally {
      setLoading(false)
    }
  }

  const fetchSessionDetail = async (sessionId) => {
    try {
      const response = await api.get(`/admin/agent-chat/sessions/${sessionId}`)
      if (response.data.success) {
        setSelectedSession(response.data.data)
      }
    } catch (err) {
      console.error('Failed to fetch session detail:', err)
    }
  }

  const handleArchive = async (sessionId) => {
    try {
      await api.post(`/admin/agent-chat/sessions/${sessionId}/archive`)
      fetchSessions()
      setSelectedSession(null)
    } catch (err) {
      console.error('Failed to archive session:', err)
    }
  }

  const filteredSessions = sessions.filter(session => {
    if (!search) return true
    const searchLower = search.toLowerCase()
    return (
      session.initiator?.name?.toLowerCase().includes(searchLower) ||
      session.receiver?.name?.toLowerCase().includes(searchLower) ||
      session.initiator?.agentId?.toLowerCase().includes(searchLower) ||
      session.receiver?.agentId?.toLowerCase().includes(searchLower)
    )
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-2xl font-bold text-white mb-1">
            Agent 聊天管理
          </h2>
          <p className="text-gray-400 text-sm">
            查看和管理所有 Agent 之间的对话
          </p>
        </div>
      </div>

      {/* 统计卡片 */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-dark-700/50 rounded-xl p-4 border border-dark-600">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-400 text-sm">总会话数</span>
              <MessageCircle className="w-4 h-4 text-blue-400" />
            </div>
            <div className="text-2xl font-bold text-white">{stats.totalSessions}</div>
          </div>

          <div className="bg-dark-700/50 rounded-xl p-4 border border-dark-600">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-400 text-sm">活跃会话</span>
              <TrendingUp className="w-4 h-4 text-green-400" />
            </div>
            <div className="text-2xl font-bold text-green-400">{stats.activeSessions}</div>
          </div>

          <div className="bg-dark-700/50 rounded-xl p-4 border border-dark-600">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-400 text-sm">任务会话</span>
              <FileText className="w-4 h-4 text-purple-400" />
            </div>
            <div className="text-2xl font-bold text-purple-400">{stats.taskSessions}</div>
          </div>

          <div className="bg-dark-700/50 rounded-xl p-4 border border-dark-600">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-400 text-sm">今日新增</span>
              <Clock className="w-4 h-4 text-orange-400" />
            </div>
            <div className="text-2xl font-bold text-orange-400">{stats.todaySessions}</div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 会话列表 */}
        <div className="bg-dark-800 rounded-xl border border-dark-700 overflow-hidden">
          <div className="p-4 border-b border-dark-700">
            <div className="flex flex-col sm:flex-row gap-3 mb-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="搜索会话..."
                  className="w-full pl-10 pr-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-primary-500"
                />
              </div>
              
              <div className="flex gap-2">
                <select
                  value={filter.status}
                  onChange={(e) => {
                    setFilter({ ...filter, status: e.target.value })
                    fetchSessions()
                  }}
                  className="px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white focus:outline-none focus:border-primary-500"
                >
                  <option value="">全部状态</option>
                  <option value="ACTIVE">进行中</option>
                  <option value="ENDED">已结束</option>
                  <option value="ARCHIVED">已归档</option>
                </select>

                <select
                  value={filter.type}
                  onChange={(e) => {
                    setFilter({ ...filter, type: e.target.value })
                    fetchSessions()
                  }}
                  className="px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white focus:outline-none focus:border-primary-500"
                >
                  <option value="">全部类型</option>
                  <option value="TASK">任务会话</option>
                  <option value="DIRECT">直接会话</option>
                </select>
              </div>
            </div>
          </div>

          <div className="max-h-[500px] overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center p-8">
                <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : filteredSessions.length === 0 ? (
              <div className="p-8 text-center text-gray-400">
                <MessageCircle className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>暂无会话</p>
              </div>
            ) : (
              <div className="divide-y divide-dark-700">
                {filteredSessions.map(session => (
                  <div
                    key={session.id}
                    onClick={() => fetchSessionDetail(session.id)}
                    className={clsx(
                      "p-4 cursor-pointer transition-colors",
                      selectedSession?.id === session.id
                        ? "bg-primary-500/20"
                        : "hover:bg-dark-700/50"
                    )}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        {session.sessionType === 'TASK' ? (
                          <FileText className="w-4 h-4 text-blue-400" />
                        ) : (
                          <Users className="w-4 h-4 text-green-400" />
                        )}
                        <span className="font-medium text-white text-sm">
                          {session.initiator?.name} ↔ {session.receiver?.name}
                        </span>
                      </div>
                      <span className={clsx(
                        "px-2 py-0.5 text-xs rounded-full",
                        session.status === 'ACTIVE' ? "bg-green-500/20 text-green-400" :
                        session.status === 'ENDED' ? "bg-gray-500/20 text-gray-400" :
                        "bg-yellow-500/20 text-yellow-400"
                      )}>
                        {session.status === 'ACTIVE' ? '进行中' :
                         session.status === 'ENDED' ? '已结束' : '已归档'}
                      </span>
                    </div>
                    
                    {session.task && (
                      <div className="text-xs text-blue-400 mb-1">
                        任务: {session.task.title}
                      </div>
                    )}
                    
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <span>
                        消息数: {session.messageCount}
                      </span>
                      <span>
                        {new Date(session.updatedAt).toLocaleString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 会话详情 */}
        <div className="bg-dark-800 rounded-xl border border-dark-700 overflow-hidden flex flex-col">
          {selectedSession ? (
            <>
              <div className="p-4 border-b border-dark-700">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="font-medium text-white">会话详情</h3>
                    <p className="text-xs text-gray-400">
                      ID: {selectedSession.id}
                    </p>
                  </div>
                  {selectedSession.status !== 'ARCHIVED' && (
                    <button
                      onClick={() => handleArchive(selectedSession.id)}
                      className="px-3 py-1.5 bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400 rounded-lg text-sm transition-colors flex items-center"
                    >
                      <Archive className="w-4 h-4 mr-1" />
                      归档
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="text-gray-400 mb-1">发起者</div>
                    <div className="text-white">{selectedSession.initiator?.name}</div>
                    <div className="text-xs text-gray-500">{selectedSession.initiator?.user?.name}</div>
                    <div className="text-xs text-gray-500">ID: {selectedSession.initiator?.agentId}</div>
                  </div>
                  <div>
                    <div className="text-gray-400 mb-1">接收者</div>
                    <div className="text-white">{selectedSession.receiver?.name}</div>
                    <div className="text-xs text-gray-500">{selectedSession.receiver?.user?.name}</div>
                    <div className="text-xs text-gray-500">ID: {selectedSession.receiver?.agentId}</div>
                  </div>
                </div>

                {selectedSession.task && (
                  <div className="mt-3 p-3 bg-dark-700/50 rounded-lg">
                    <div className="text-sm text-gray-400 mb-1">关联任务</div>
                    <div className="text-white">{selectedSession.task.title}</div>
                  </div>
                )}
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {selectedSession.messages?.map(msg => (
                  <div
                    key={msg.id}
                    className={clsx(
                      "flex",
                      msg.type === 'SYSTEM' ? "justify-center" :
                      msg.sender?.agentId === selectedSession.initiator?.agentId
                        ? "justify-start"
                        : "justify-end"
                    )}
                  >
                    {msg.type === 'SYSTEM' ? (
                      <div className="px-3 py-1 bg-gray-500/20 text-gray-400 text-xs rounded-full">
                        {msg.content}
                      </div>
                    ) : (
                      <div
                        className={clsx(
                          "max-w-[80%] px-3 py-2 rounded-lg",
                          msg.sender?.agentId === selectedSession.initiator?.agentId
                            ? "bg-blue-500/20 text-white"
                            : "bg-green-500/20 text-white"
                        )}
                      >
                        <div className="text-xs text-gray-400 mb-1">
                          {msg.sender?.name}
                        </div>
                        <div className="text-sm">{msg.content}</div>
                        <div className="text-xs text-gray-500 mt-1">
                          {new Date(msg.createdAt).toLocaleString()}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-400">
              <div className="text-center">
                <Eye className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>选择会话查看详情</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default AdminChatManagement