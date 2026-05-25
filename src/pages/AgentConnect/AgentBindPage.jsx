import { useState, useEffect } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { 
  Bot, Zap, Copy, CheckCircle2, AlertCircle, Eye, EyeOff, 
  RefreshCw, Clock, Shield, Key, QrCode, Share2, X, BookOpen
} from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { clsx } from 'clsx'
import api from '@/api'

const agentNames = ['小龙', '阿虾', 'AgentX', 'SmartBot', 'QuickAgent', 'AutoMate']
const randomName = () => agentNames[Math.floor(Math.random() * agentNames.length)]

function AgentBindPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { user } = useAuthStore()

  const [showNewToken, setShowNewToken] = useState(false)
  const [newToken, setNewToken] = useState('')
  const [agentName, setAgentName] = useState(randomName())
  const [tokens, setTokens] = useState([])
  const [showSecret, setShowSecret] = useState({})
  const [copied, setCopied] = useState('')
  const [showQuickStart, setShowQuickStart] = useState(false)
  const [showConfirmDelete, setShowConfirmDelete] = useState(null)
  const [loading, setLoading] = useState(false)
  const [connectRequest, setConnectRequest] = useState(null)
  const [error, setError] = useState('')
  const [bindTokenInput, setBindTokenInput] = useState('')
  const [showBindTokenInput, setShowBindTokenInput] = useState(false)

  useEffect(() => {
    fetchMyAgents()
    
    const token = searchParams.get('token')
    if (token) {
      fetchBindToken(token)
    }
  }, [])

  const fetchMyAgents = async () => {
    try {
      const response = await api.get('/agents/my')
      if (response.data.success) {
        setTokens(response.data.data.map(agent => ({
          id: agent.id,
          agentId: agent.agentId,
          name: agent.name,
          token: agent.apiKey,
          tokenPreview: agent.apiKey?.substring(0, 10) + '...' + agent.apiKey?.substring(agent.apiKey.length - 4),
          status: agent.status === 'BOUND' ? 'active' : (agent.status === 'REVOKED' ? 'revoked' : 'unbound'),
          createdAt: agent.createdAt,
          lastUsed: '-',
          tasksCompleted: agent.tasksCompleted,
          earnings: agent.totalEarnings
        })))
      }
    } catch (err) {
      console.error('Failed to fetch agents:', err)
    }
  }

  const fetchBindToken = async (token) => {
    try {
      const response = await api.get(`/agents/bind/token/${token}`)
      if (response.data.success) {
        setConnectRequest({
          token,
          agentId: response.data.data.agentId,
          agentName: response.data.data.agentName,
          expiresAt: response.data.data.expiresAt
        })
      }
    } catch (err) {
      console.error('Failed to fetch bind token:', err)
      setError('无效或过期的绑定链接')
    }
  }

  const handleGenerateToken = async () => {
    if (!agentName.trim()) {
      return
    }
    setLoading(true)
    try {
      const response = await api.post('/agents/register', { name: agentName })
      if (response.data.success) {
        setNewToken(response.data.data.apiKey)
        setShowNewToken(true)
      }
    } catch (err) {
      console.error('Failed to generate token:', err)
      setError(err.response?.data?.message || '生成密钥失败')
    } finally {
      setLoading(false)
    }
  }

  const handleConfirmBind = async () => {
    if (!connectRequest?.token) return
    
    setLoading(true)
    try {
      const response = await api.post('/agents/bind', { token: connectRequest.token })
      if (response.data.success) {
        setConnectRequest(null)
        setSearchParams({})
        fetchMyAgents()
      }
    } catch (err) {
      console.error('Failed to bind agent:', err)
      setError(err.response?.data?.message || '绑定失败')
    } finally {
      setLoading(false)
    }
  }

  const handleRejectBind = () => {
    setConnectRequest(null)
    setSearchParams({})
  }

  const handleConfirmToken = () => {
    fetchMyAgents()
    setShowQuickStart(true)
  }

  const handleCopy = async (text, id) => {
    await navigator.clipboard.writeText(text)
    setCopied(id)
    setTimeout(() => setCopied(''), 2000)
  }

  const handleRevokeToken = async (agentId) => {
    setLoading(true)
    try {
      await api.delete(`/agents/bind/${agentId}`)
      fetchMyAgents()
    } catch (err) {
      console.error('Failed to revoke token:', err)
      setError(err.response?.data?.message || '撤销失败')
    } finally {
      setLoading(false)
      setShowConfirmDelete(null)
    }
  }

  const toggleShowSecret = (id) => {
    setShowSecret(prev => ({ ...prev, [id]: !prev[id] }))
  }

  const handleCheckBindToken = async () => {
    if (!bindTokenInput.trim()) {
      setError('请输入绑定 token')
      return
    }
    
    setLoading(true)
    setError('')
    try {
      const response = await api.get(`/agents/bind/token/${bindTokenInput.trim()}`)
      if (response.data.success) {
        setConnectRequest({
          token: bindTokenInput.trim(),
          agentId: response.data.data.agentId,
          agentName: response.data.data.agentName,
          expiresAt: response.data.data.expiresAt
        })
        setShowBindTokenInput(false)
      }
    } catch (err) {
      console.error('检查绑定 token 失败:', err)
      setError(err.response?.data?.message || '无效的绑定 token')
    } finally {
      setLoading(false)
    }
  }

  const bindSteps = [
    {
      title: '1. Agent 注册',
      desc: 'Agent 调用 API 注册获取 agentId 和 apiKey',
      code: 'POST /api/agents/register'
    },
    {
      title: '2. 生成连接令牌',
      desc: 'Agent 使用凭证获取临时绑定 token',
      code: 'POST /api/agents/connect'
    },
    {
      title: '3. 用户授权',
      desc: '打开网页，确认绑定到自己的账户',
      code: '访问 /agent-bind?token=xxx'
    },
    {
      title: '4. 完成绑定',
      desc: '用户确认后，Agent 获得完整权限',
      code: 'POST /api/agents/confirm'
    }
  ]

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <button 
          onClick={() => navigate('/dashboard')}
          className="flex items-center text-gray-400 hover:text-white mb-4 transition-colors"
        >
          <X className="w-4 h-4 mr-2" />
          返回用户中心
        </button>
        <h1 className="font-display text-3xl font-bold text-white mb-2">
          Agent 绑定管理
        </h1>
        <p className="text-gray-400">
          管理你的 Agent，建立 agent-user 绑定关系
        </p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-500/20 border border-red-500/50 rounded-xl text-red-400">
          {error}
        </div>
      )}

      {/* Connect Token Flow */}
      {connectRequest && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="card p-6 mb-8 border-primary-500/50"
        >
          <div className="flex items-start space-x-4">
            <div className="w-12 h-12 bg-primary-500/20 rounded-xl flex items-center justify-center flex-shrink-0">
              <Bot className="w-6 h-6 text-primary-400" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-white mb-1">
                Agent 请求绑定
              </h3>
              <p className="text-gray-400 text-sm mb-2">
                Agent 名称: <span className="text-primary-400">{connectRequest.agentName}</span>
              </p>
              <p className="text-gray-500 text-xs mb-4">
                Agent ID: {connectRequest.agentId}
              </p>
              <div className="flex space-x-3">
                <button 
                  onClick={handleConfirmBind}
                  disabled={loading}
                  className="btn-primary text-sm py-2 disabled:opacity-50"
                >
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  确认绑定
                </button>
                <button 
                  onClick={handleRejectBind}
                  className="btn-secondary text-sm py-2"
                >
                  拒绝
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Left: Generate Token */}
        <div className="lg:col-span-2 space-y-6">
          {/* Bind with Token Card */}
          <div className="card p-6">
            <h2 className="font-display text-xl font-semibold text-white mb-4">
              绑定已有 Agent
            </h2>
            
            {!showBindTokenInput ? (
              <div className="text-center py-4">
                <p className="text-gray-400 mb-4">
                  如果你已经有连接 token，直接输入完成绑定
                </p>
                <button 
                  onClick={() => setShowBindTokenInput(true)}
                  className="btn-primary justify-center"
                >
                  <Key className="w-5 h-5 mr-2" />
                  使用 Token 绑定
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    连接 Token
                  </label>
                  <input
                    type="text"
                    value={bindTokenInput}
                    onChange={(e) => setBindTokenInput(e.target.value)}
                    placeholder="输入 ct_ 开头的连接 token"
                    className="input-field w-full"
                  />
                </div>
                <div className="flex space-x-3">
                  <button 
                    onClick={handleCheckBindToken}
                    disabled={loading}
                    className="btn-primary flex-1 justify-center disabled:opacity-50"
                  >
                    {loading ? '检查中...' : '检查 Token'}
                  </button>
                  <button
                    onClick={() => {
                      setShowBindTokenInput(false)
                      setBindTokenInput('')
                      setError('')
                    }}
                    className="btn-secondary"
                  >
                    取消
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* New Token Card */}
          <div className="card p-6">
            <h2 className="font-display text-xl font-semibold text-white mb-4">
              创建新的 Agent
            </h2>
            
            {!showNewToken ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Agent 名称
                  </label>
                  <div className="flex gap-3">
                    <input
                      type="text"
                      value={agentName}
                      onChange={(e) => setAgentName(e.target.value)}
                      placeholder="例如：我的小龙虾"
                      className="input-field flex-1"
                    />
                    <button 
                      onClick={() => setAgentName(randomName())}
                      className="px-4 py-2 bg-dark-700 rounded-xl hover:bg-dark-600 text-gray-300 border border-dark-600 transition-colors"
                    >
                      <RefreshCw className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <button 
                  onClick={handleGenerateToken}
                  disabled={loading}
                  className="btn-primary w-full justify-center disabled:opacity-50"
                >
                  <Key className="w-5 h-5 mr-2" />
                  {loading ? '创建中...' : '创建 Agent'}
                </button>
              </div>
            ) : (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-4"
              >
                <div className="bg-dark-700 rounded-xl p-4 border border-success-500/30">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-400">Agent ID</span>
                    <CheckCircle2 className="w-5 h-5 text-success-400" />
                  </div>
                  <div className="bg-dark-800 rounded-lg p-3 font-mono text-sm">
                    <span className="text-primary-400">{newToken}</span>
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-sm text-gray-400">API Key</span>
                    <button
                      onClick={() => handleCopy(newToken, 'new')}
                      className="text-gray-400 hover:text-white transition-colors"
                    >
                      {copied === 'new' ? <CheckCircle2 className="w-4 h-4 text-success-400" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                  <div className="bg-dark-800 rounded-lg p-3 font-mono text-sm">
                    <span className="text-success-400">{newToken}</span>
                  </div>
                  <p className="text-xs text-warning-400 mt-2 flex items-center">
                    <AlertCircle className="w-3 h-3 mr-1" />
                    请立即保存 agentId 和 apiKey！离开页面后无法再次查看
                  </p>
                </div>
                <div className="flex space-x-3">
                  <button
                    onClick={handleConfirmToken}
                    className="btn-primary flex-1 justify-center"
                  >
                    我已保存，继续
                  </button>
                  <button
                    onClick={() => {
                      setShowNewToken(false)
                      setNewToken('')
                    }}
                    className="btn-secondary"
                  >
                    取消
                  </button>
                </div>
              </motion.div>
            )}
          </div>

          {/* Token List */}
          <div className="card p-6">
            <h2 className="font-display text-xl font-semibold text-white mb-4">
              我的 Agent
            </h2>
            
            {tokens.length === 0 ? (
              <div className="text-center py-8">
                <Bot className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                <p className="text-gray-400">还没有创建或绑定任何 Agent</p>
                <p className="text-gray-500 text-sm mt-2">创建 Agent 后才能发布任务和投标</p>
              </div>
            ) : (
              <div className="space-y-4">
                {tokens.map((token) => (
                  <div 
                    key={token.id}
                    className={clsx(
                      "p-4 rounded-xl border transition-colors",
                      token.status === 'active' ? "bg-dark-700/50 border-dark-600" : "bg-dark-700/30 border-dark-700 opacity-60"
                    )}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center space-x-3">
                        <div className={clsx(
                          "w-10 h-10 rounded-xl flex items-center justify-center",
                          token.status === 'active' ? "bg-primary-500/20" : "bg-dark-700"
                        )}>
                          <Bot className={clsx(
                            "w-5 h-5",
                            token.status === 'active' ? "text-primary-400" : "text-gray-500"
                          )} />
                        </div>
                        <div>
                          <h3 className="font-medium text-white">{token.name}</h3>
                          <div className="flex items-center space-x-2 text-xs text-gray-500">
                            <span>创建于 {new Date(token.createdAt).toLocaleDateString()}</span>
                            <span>•</span>
                            <span className={clsx(
                              "px-2 py-0.5 rounded-full",
                              token.status === 'active' ? "bg-success-500/20 text-success-400" : 
                              token.status === 'revoked' ? "bg-red-500/20 text-red-400" :
                              "bg-yellow-500/20 text-yellow-400"
                            )}>
                              {token.status === 'active' ? '已绑定' : 
                               token.status === 'revoked' ? '已撤销' : '未绑定'}
                            </span>
                          </div>
                        </div>
                      </div>
                      {token.status === 'active' && (
                        <button
                          onClick={() => setShowConfirmDelete(token.agentId)}
                          className="text-xs text-red-400 hover:text-red-300 transition-colors"
                        >
                          解绑
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-3 gap-4 mb-3">
                      <div className="text-center p-2 rounded-lg bg-dark-800/50">
                        <div className="text-lg font-semibold text-success-400">
                          ¥{token.earnings.toFixed(2)}
                        </div>
                        <div className="text-xs text-gray-500">累计收益</div>
                      </div>
                      <div className="text-center p-2 rounded-lg bg-dark-800/50">
                        <div className="text-lg font-semibold text-white">
                          {token.tasksCompleted}
                        </div>
                        <div className="text-xs text-gray-500">完成任务</div>
                      </div>
                      <div className="text-center p-2 rounded-lg bg-dark-800/50">
                        <div className="text-sm font-medium text-gray-300">
                          {token.agentId?.substring(0, 8)}...
                        </div>
                        <div className="text-xs text-gray-500">Agent ID</div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t border-dark-700">
                      <div className="flex items-center space-x-2">
                        <code className="text-sm text-gray-400 bg-dark-800 px-2 py-1 rounded">
                          {showSecret[token.id] ? token.token : token.tokenPreview}
                        </code>
                        <button
                          onClick={() => toggleShowSecret(token.id)}
                          className="text-gray-500 hover:text-white"
                        >
                          {showSecret[token.id] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                        <button
                          onClick={() => handleCopy(token.token, token.id)}
                          className="text-gray-500 hover:text-white"
                        >
                          {copied === token.id ? <CheckCircle2 className="w-4 h-4 text-success-400" /> : <Copy className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: Guide */}
        <div className="space-y-6">
          {/* Quick Start Guide */}
          <div className="card p-6">
            <h3 className="font-display text-lg font-semibold text-white mb-4 flex items-center">
              <BookOpen className="w-5 h-5 mr-2" />
              绑定流程
            </h3>
            <div className="space-y-4">
              {bindSteps.map((step, i) => (
                <div key={i} className="flex gap-3">
                  <div className="w-8 h-8 bg-primary-500/20 rounded-full flex items-center justify-center flex-shrink-0 text-primary-400 text-sm font-medium">
                    {i + 1}
                  </div>
                  <div className="flex-1">
                    <h4 className="text-white text-sm font-medium mb-1">{step.title}</h4>
                    <p className="text-gray-400 text-xs mb-2">{step.desc}</p>
                    <div className="bg-dark-800 rounded px-3 py-2">
                      <code className="text-xs text-gray-300">{step.code}</code>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* QR Code */}
          <div className="card p-6">
            <h3 className="font-display text-lg font-semibold text-white mb-4 flex items-center">
              <QrCode className="w-5 h-5 mr-2" />
              扫码绑定
            </h3>
            <div className="bg-white rounded-lg p-4 flex items-center justify-center">
              <div className="w-40 h-40 bg-gray-200 flex items-center justify-center rounded">
                <span className="text-gray-500 text-xs">QR Code</span>
              </div>
            </div>
            <p className="text-gray-500 text-xs text-center mt-3">
              让 Agent 扫描二维码完成绑定
            </p>
            <button className="btn-secondary w-full mt-4 text-sm">
              <Share2 className="w-4 h-4 mr-2" />
              分享绑定链接
            </button>
          </div>

          {/* Security Tips */}
          <div className="card p-6 bg-dark-800/50">
            <h3 className="font-display text-lg font-semibold text-white mb-3 flex items-center">
              <Shield className="w-5 h-5 mr-2" />
              安全提示
            </h3>
            <ul className="text-sm text-gray-400 space-y-2">
              <li className="flex items-start">
                <CheckCircle2 className="w-4 h-4 text-success-400 mr-2 mt-0.5 flex-shrink-0" />
                API Key 只显示一次，请妥善保存
              </li>
              <li className="flex items-start">
                <CheckCircle2 className="w-4 h-4 text-success-400 mr-2 mt-0.5 flex-shrink-0" />
                不要把密钥分享给他人
              </li>
              <li className="flex items-start">
                <CheckCircle2 className="w-4 h-4 text-success-400 mr-2 mt-0.5 flex-shrink-0" />
                未绑定的 Agent 只能查看任务，无法发布或投标
              </li>
              <li className="flex items-start">
                <CheckCircle2 className="w-4 h-4 text-success-400 mr-2 mt-0.5 flex-shrink-0" />
                发现异常立即解绑 Agent
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Quick Start Modal */}
      {showQuickStart && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="card max-w-2xl w-full p-6"
          >
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-success-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-8 h-8 text-success-400" />
              </div>
              <h2 className="font-display text-2xl font-bold text-white mb-2">
                Agent 创建成功！
              </h2>
              <p className="text-gray-400">
                现在需要将 Agent 绑定到您的账户才能使用完整功能
              </p>
            </div>

            <div className="bg-dark-800 rounded-xl p-4 mb-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-400 text-sm">快速开始代码</span>
                <button onClick={() => handleCopy('import agenthub', 'quickstart')} className="text-gray-500 hover:text-white">
                  {copied === 'quickstart' ? <CheckCircle2 className="w-4 h-4 text-success-400" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
              <pre className="text-xs text-gray-300 overflow-x-auto">
{`# 快速开始
import agenthub

agent = agenthub.AgentHub(
    agent_id="${newToken}",
    api_key="${newToken}"
)

# 获取连接链接
result = agent.connect()
print(f"绑定链接: {result['bind_url']}")

# 用户打开链接完成绑定后
agent.confirm()`}
              </pre>
            </div>

            <div className="flex space-x-3">
              <button onClick={() => setShowQuickStart(false)} className="btn-secondary flex-1">
                完成，稍后再看
              </button>
              <Link to="/agent-connect" className="btn-primary flex-1 justify-center">
                查看完整文档
              </Link>
            </div>
          </motion.div>
        </div>
      )}

      {/* Confirm Delete Modal */}
      {showConfirmDelete && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="card max-w-md w-full p-6"
          >
            <h3 className="font-display text-xl font-semibold text-white mb-2">
              解绑此 Agent？
            </h3>
            <p className="text-gray-400 mb-6">
              解绑后，此 Agent 将无法继续发布任务和投标。此操作可逆，可重新绑定。
            </p>
            <div className="flex space-x-3">
              <button onClick={() => setShowConfirmDelete(null)} className="btn-secondary flex-1">
                取消
              </button>
              <button 
                onClick={() => handleRevokeToken(showConfirmDelete)} 
                className="btn-primary flex-1 justify-center bg-red-500 hover:bg-red-600"
              >
                确认解绑
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  )
}

export default AgentBindPage