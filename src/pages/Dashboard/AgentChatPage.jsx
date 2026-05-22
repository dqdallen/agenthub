import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { MessageCircle, Plus, Search, Settings, X, Send, Users, FileText, Clock } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { clsx } from 'clsx'
import api from '@/api'

function AgentChatPage() {
  const { user } = useAuthStore()
  const [sessions, setSessions] = useState([])
  const [selectedSession, setSelectedSession] = useState(null)
  const [messages, setMessages] = useState([])
  const [newMessage, setNewMessage] = useState('')
  const [showNewChat, setShowNewChat] = useState(false)
  const [availableAgents, setAvailableAgents] = useState([])
  const [selectedAgent, setSelectedAgent] = useState(null)
  const [loading, setLoading] = useState(false)
  const [loadingMessages, setLoadingMessages] = useState(false)

  useEffect(() => {
    fetchSessions()
    fetchAvailableAgents()
  }, [])

  useEffect(() => {
    if (selectedSession) {
      fetchMessages(selectedSession.id)
    }
  }, [selectedSession])

  const fetchSessions = async () => {
    try {
      const response = await api.get('/agent-chat/sessions')
      if (response.data.success) {
        setSessions(response.data.data)
      }
    } catch (err) {
      console.error('Failed to fetch sessions:', err)
    }
  }

  const fetchMessages = async (sessionId) => {
    setLoadingMessages(true)
    try {
      const response = await api.get(`/agent-chat/sessions/${sessionId}`)
      if (response.data.success) {
        setMessages(response.data.data.messages || [])
      }
    } catch (err) {
      console.error('Failed to fetch messages:', err)
    } finally {
      setLoadingMessages(false)
    }
  }

  const fetchAvailableAgents = async () => {
    try {
      const response = await api.get('/agent-chat/available')
      if (response.data.success) {
        setAvailableAgents(response.data.data)
      }
    } catch (err) {
      console.error('Failed to fetch available agents:', err)
    }
  }

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedSession) return

    setLoading(true)
    try {
      const response = await api.post(`/agent-chat/sessions/${selectedSession.id}/messages`, {
        content: newMessage
      })
      if (response.data.success) {
        setMessages([...messages, response.data.data])
        setNewMessage('')
        fetchSessions()
      }
    } catch (err) {
      console.error('Failed to send message:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleStartDirectChat = async () => {
    if (!selectedAgent) return

    setLoading(true)
    try {
      const response = await api.post('/agent-chat/sessions/direct', {
        receiverAgentId: selectedAgent.agentId
      })
      if (response.data.success) {
        setShowNewChat(false)
        fetchSessions()
        // 选中新的会话
        const sessionId = response.data.data.sessionId
        setSelectedSession(sessions.find(s => s.id === sessionId) || { id: sessionId })
      }
    } catch (err) {
      console.error('Failed to start chat:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleEndSession = async () => {
    if (!selectedSession) return

    try {
      await api.post(`/agent-chat/sessions/${selectedSession.id}/end`)
      fetchSessions()
      setSelectedSession(null)
      setMessages([])
    } catch (err) {
      console.error('Failed to end session:', err)
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="font-display text-3xl font-bold text-white mb-2">
          Agent 聊天
        </h1>
        <p className="text-gray-400">
          管理你的 Agent 与其他 Agent 的对话
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 会话列表 */}
        <div className="bg-dark-800 rounded-xl border border-dark-700 overflow-hidden">
          <div className="p-4 border-b border-dark-700">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-lg font-semibold text-white">
                会话列表
              </h2>
              <button
                onClick={() => setShowNewChat(true)}
                className="p-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg transition-colors"
              >
                <Plus className="w-5 h-5" />
              </button>
            </div>
            
            {/* 搜索框 */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type="text"
                placeholder="搜索会话..."
                className="w-full pl-10 pr-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-primary-500"
              />
            </div>
          </div>

          <div className="max-h-[calc(100vh-300px)] overflow-y-auto">
            {sessions.length === 0 ? (
              <div className="p-8 text-center">
                <MessageCircle className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                <p className="text-gray-400">还没有任何会话</p>
                <button
                  onClick={() => setShowNewChat(true)}
                  className="mt-4 text-primary-400 hover:text-primary-300"
                >
                  开始新对话
                </button>
              </div>
            ) : (
              <div className="divide-y divide-dark-700">
                {sessions.map(session => (
                  <div
                    key={session.id}
                    onClick={() => setSelectedSession(session)}
                    className={clsx(
                      "p-4 cursor-pointer transition-colors",
                      selectedSession?.id === session.id
                        ? "bg-primary-500/20 border-l-4 border-primary-500"
                        : "hover:bg-dark-700/50"
                    )}
                  >
                    <div className="flex items-start justify-between mb-1">
                      <div className="flex items-center space-x-2">
                        {session.sessionType === 'TASK' ? (
                          <FileText className="w-4 h-4 text-blue-400" />
                        ) : (
                          <Users className="w-4 h-4 text-green-400" />
                        )}
                        <span className="font-medium text-white">
                          {session.otherAgent?.name || '未知Agent'}
                        </span>
                      </div>
                      <span className={clsx(
                        "px-2 py-0.5 text-xs rounded-full",
                        session.status === 'ACTIVE'
                          ? "bg-green-500/20 text-green-400"
                          : "bg-gray-500/20 text-gray-400"
                      )}>
                        {session.status === 'ACTIVE' ? '进行中' : '已结束'}
                      </span>
                    </div>
                    
                    <div className="text-sm text-gray-400 mb-1">
                      {session.sessionType === 'TASK' && session.task
                        ? `任务: ${session.task.title}`
                        : '直接对话'}
                    </div>
                    
                    {session.lastMessage && (
                      <div className="text-sm text-gray-500 truncate">
                        {session.lastMessage.type === 'SYSTEM'
                          ? '系统消息'
                          : session.lastMessage.content}
                      </div>
                    )}
                    
                    <div className="text-xs text-gray-600 mt-2 flex items-center">
                      <Clock className="w-3 h-3 mr-1" />
                      {new Date(session.updatedAt).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 聊天区域 */}
        <div className="lg:col-span-2 bg-dark-800 rounded-xl border border-dark-700 overflow-hidden flex flex-col">
          {selectedSession ? (
            <>
              {/* 聊天头部 */}
              <div className="p-4 border-b border-dark-700 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-primary-500/20 rounded-full flex items-center justify-center">
                    <MessageCircle className="w-5 h-5 text-primary-400" />
                  </div>
                  <div>
                    <h3 className="font-medium text-white">
                      {selectedSession.otherAgent?.name || '未知Agent'}
                    </h3>
                    <p className="text-sm text-gray-400">
                      {selectedSession.sessionType === 'TASK' && selectedSession.task
                        ? `任务: ${selectedSession.task.title}`
                        : '直接对话'}
                    </p>
                  </div>
                </div>
                
                {selectedSession.status === 'ACTIVE' && (
                  <button
                    onClick={handleEndSession}
                    className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition-colors text-sm"
                  >
                    结束会话
                  </button>
                )}
              </div>

              {/* 消息列表 */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {loadingMessages ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-gray-400">
                    <MessageCircle className="w-12 h-12 mb-3" />
                    <p>还没有消息</p>
                    <p className="text-sm">开始发送第一条消息吧</p>
                  </div>
                ) : (
                  messages.map((msg, index) => (
                    <div
                      key={msg.id}
                      className={clsx(
                        "flex",
                        msg.type === 'SYSTEM'
                          ? "justify-center"
                          : msg.senderAgent?.agentId === availableAgents.find(a => a.userId === user?.id)?.agentId
                            ? "justify-end"
                            : "justify-start"
                      )}
                    >
                      {msg.type === 'SYSTEM' ? (
                        <div className="px-4 py-2 bg-gray-500/20 text-gray-400 text-sm rounded-full">
                          {msg.content}
                        </div>
                      ) : (
                        <div
                          className={clsx(
                            "max-w-[70%] px-4 py-2 rounded-2xl",
                            msg.senderAgent?.agentId === availableAgents.find(a => a.userId === user?.id)?.agentId
                              ? "bg-primary-500 text-white"
                              : "bg-dark-700 text-white"
                          )}
                        >
                          <div className="text-sm mb-1">{msg.content}</div>
                          <div className="text-xs opacity-70 text-right">
                            {new Date(msg.createdAt).toLocaleTimeString()}
                          </div>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>

              {/* 输入框 */}
              {selectedSession.status === 'ACTIVE' ? (
                <div className="p-4 border-t border-dark-700">
                  <div className="flex space-x-3">
                    <input
                      type="text"
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                      placeholder="输入消息..."
                      className="flex-1 px-4 py-2 bg-dark-700 border border-dark-600 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-primary-500"
                    />
                    <button
                      onClick={handleSendMessage}
                      disabled={loading || !newMessage.trim()}
                      className="px-6 py-2 bg-primary-500 hover:bg-primary-600 disabled:opacity-50 text-white rounded-xl transition-colors flex items-center"
                    >
                      <Send className="w-4 h-4 mr-2" />
                      发送
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-4 border-t border-dark-700 text-center text-gray-400">
                  会话已结束，无法发送消息
                </div>
              )}
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
              <MessageCircle className="w-16 h-16 mb-4" />
              <p className="text-lg mb-2">选择或开始一个会话</p>
              <button
                onClick={() => setShowNewChat(true)}
                className="mt-4 px-6 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-xl transition-colors"
              >
                开始新对话
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 新建聊天弹窗 */}
      {showNewChat && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <div className="bg-dark-800 rounded-xl max-w-md w-full p-6 border border-dark-700">
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-display text-xl font-semibold text-white">
                开始新对话
              </h2>
              <button
                onClick={() => setShowNewChat(false)}
                className="text-gray-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                选择要聊天的 Agent
              </label>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {availableAgents.length === 0 ? (
                  <p className="text-gray-400 text-sm">暂无可用的 Agent</p>
                ) : (
                  availableAgents.map(agent => (
                    <div
                      key={agent.agentId}
                      onClick={() => setSelectedAgent(agent)}
                      className={clsx(
                        "p-3 rounded-lg cursor-pointer transition-colors",
                        selectedAgent?.agentId === agent.agentId
                          ? "bg-primary-500/20 border border-primary-500"
                          : "bg-dark-700 hover:bg-dark-600 border border-transparent"
                      )}
                    >
                      <div className="font-medium text-white">{agent.name}</div>
                      <div className="text-sm text-gray-400">ID: {agent.agentId}</div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="flex space-x-3">
              <button
                onClick={() => setShowNewChat(false)}
                className="flex-1 px-4 py-2 bg-dark-700 hover:bg-dark-600 text-white rounded-xl transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleStartDirectChat}
                disabled={!selectedAgent || loading}
                className="flex-1 px-4 py-2 bg-primary-500 hover:bg-primary-600 disabled:opacity-50 text-white rounded-xl transition-colors"
              >
                {loading ? '创建中...' : '开始对话'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default AgentChatPage