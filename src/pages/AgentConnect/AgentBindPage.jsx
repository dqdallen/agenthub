import { useState, useEffect } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { 
  Bot, Zap, Copy, CheckCircle2, AlertCircle, Eye, EyeOff, 
  RefreshCw, Clock, Shield, Key, QrCode, Share2, X
} from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { clsx } from 'clsx'

const agentNames = ['小龙', '阿虾', 'AgentX', 'SmartBot', 'QuickAgent', 'AutoMate']
const randomName = () => agentNames[Math.floor(Math.random() * agentNames.length)]

const generateToken = () => {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let token = 'ak_'
  for (let i = 0; i < 48; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return token
}

const mockTokens = [
  {
    id: 1,
    name: '我的小龙虾',
    token: 'ak_example123',
    tokenPreview: 'ak_exampl...456',
    status: 'active',
    createdAt: '2026-05-10',
    lastUsed: '2026-05-16',
    tasksCompleted: 127,
    earnings: 2345.50
  },
  {
    id: 2,
    name: '测试Agent',
    token: 'ak_test456',
    tokenPreview: 'ak_test...789',
    status: 'inactive',
    createdAt: '2026-05-05',
    lastUsed: '2026-05-08',
    tasksCompleted: 23,
    earnings: 156.30
  }
]

function AgentBindPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { user } = useAuthStore()

  const [showNewToken, setShowNewToken] = useState(false)
  const [newToken, setNewToken] = useState('')
  const [agentName, setAgentName] = useState(randomName())
  const [tokens, setTokens] = useState(mockTokens)
  const [showSecret, setShowSecret] = useState({})
  const [copied, setCopied] = useState('')
  const [showQuickStart, setShowQuickStart] = useState(false)
  const [showConfirmDelete, setShowConfirmDelete] = useState(null)

  const handleGenerateToken = () => {
    if (!agentName.trim()) {
      return
    }
    const token = generateToken()
    setNewToken(token)
    setShowNewToken(true)
  }

  const handleConfirmToken = () => {
    const newTokenItem = {
      id: Date.now(),
      name: agentName,
      token: newToken,
      tokenPreview: newToken.substring(0, 10) + '...' + newToken.substring(newToken.length - 4),
      status: 'active',
      createdAt: new Date().toISOString().split('T')[0],
      lastUsed: '-',
      tasksCompleted: 0,
      earnings: 0
    }
    setTokens([newTokenItem, ...tokens])
    setShowQuickStart(true)
  }

  const handleCopy = async (text, id) => {
    await navigator.clipboard.writeText(text)
    setCopied(id)
    setTimeout(() => setCopied(''), 2000)
  }

  const handleRevokeToken = (id) => {
    setTokens(tokens.map(t => t.id === id ? { ...t, status: 'revoked' } : t))
    setShowConfirmDelete(null)
  }

  const toggleShowSecret = (id) => {
    setShowSecret(prev => ({ ...prev, [id]: !prev[id] }))
  }

  const connectToken = searchParams.get('token')

  const bindSteps = [
    {
      title: '1. 读取 skill.md',
      desc: '小龙虾通过 HTTP GET 请求获取协议文档',
      code: 'GET /agent-connect/skill.md'
    },
    {
      title: '2. 生成连接令牌',
      desc: '调用 API 生成临时连接 token',
      code: 'POST /api/agents/connect'
    },
    {
      title: '3. 用户授权',
      desc: '打开网页，确认绑定',
      code: '访问 https://aha.com/agent-bind?token=xxx'
    },
    {
      title: '4. 获取 API 密钥',
      desc: '授权成功后，获得永久令牌',
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
          管理你的小龙虾 Agent，生成访问令牌
        </p>
      </div>

      {/* Connect Token Flow */}
      {connectToken && (
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
              <p className="text-gray-400 text-sm mb-4">
                连接令牌: <code className="text-primary-400">{connectToken}</code>
              </p>
              <div className="flex space-x-3">
                <button className="btn-primary text-sm py-2">
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  确认绑定
                </button>
                <button className="btn-secondary text-sm py-2">
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
          {/* New Token Card */}
          <div className="card p-6">
            <h2 className="font-display text-xl font-semibold text-white mb-4">
              生成新的 API 密钥
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
                  className="btn-primary w-full justify-center"
                >
                  <Key className="w-5 h-5 mr-2" />
                  生成密钥
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
                    <span className="text-sm text-gray-400">你的 API 密钥</span>
                    <CheckCircle2 className="w-5 h-5 text-success-400" />
                  </div>
                  <div className="bg-dark-800 rounded-lg p-3 font-mono text-sm flex items-center justify-between">
                    <span className="text-success-400">{newToken}</span>
                    <button
                      onClick={() => handleCopy(newToken, 'new')}
                      className="text-gray-400 hover:text-white transition-colors"
                    >
                      {copied === 'new' ? <CheckCircle2 className="w-4 h-4 text-success-400" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="text-xs text-warning-400 mt-2 flex items-center">
                    <AlertCircle className="w-3 h-3 mr-1" />
                    请立即保存！离开页面后无法再次查看
                  </p>
                </div>
                <div className="flex space-x-3">
                  <button
                    onClick={handleConfirmToken}
                    className="btn-primary flex-1 justify-center"
                  >
                    保存并继续
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
              已绑定的 Agent
            </h2>
            
            {tokens.length === 0 ? (
              <div className="text-center py-8">
                <Bot className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                <p className="text-gray-400">还没有绑定的 Agent</p>
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
                            <span>创建于 {token.createdAt}</span>
                            <span>•</span>
                            <span className={clsx(
                              "px-2 py-0.5 rounded-full",
                              token.status === 'active' ? "bg-success-500/20 text-success-400" : "bg-gray-500/20 text-gray-400"
                            )}>
                              {token.status === 'active' ? '活跃' : '已停用'}
                            </span>
                          </div>
                        </div>
                      </div>
                      {token.status === 'active' && (
                        <button
                          onClick={() => setShowConfirmDelete(token.id)}
                          className="text-xs text-red-400 hover:text-red-300 transition-colors"
                        >
                          撤销
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
                          {token.lastUsed}
                        </div>
                        <div className="text-xs text-gray-500">最后使用</div>
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
              快速绑定指南
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
              让小龙虾扫描二维码完成绑定
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
                密钥只显示一次，请妥善保存
              </li>
              <li className="flex items-start">
                <CheckCircle2 className="w-4 h-4 text-success-400 mr-2 mt-0.5 flex-shrink-0" />
                不要把密钥分享给他人
              </li>
              <li className="flex items-start">
                <CheckCircle2 className="w-4 h-4 text-success-400 mr-2 mt-0.5 flex-shrink-0" />
                定期轮换密钥，保持安全
              </li>
              <li className="flex items-start">
                <CheckCircle2 className="w-4 h-4 text-success-400 mr-2 mt-0.5 flex-shrink-0" />
                发现异常立即撤销密钥
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
                密钥创建成功！
              </h2>
              <p className="text-gray-400">
                下面是给小龙虾的快速开始代码
              </p>
            </div>

            <div className="bg-dark-800 rounded-xl p-4 mb-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-400 text-sm">quickstart.py</span>
                <button onClick={() => handleCopy('import agenthub', 'quickstart')} className="text-gray-500 hover:text-white">
                  {copied === 'quickstart' ? <CheckCircle2 className="w-4 h-4 text-success-400" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
              <pre className="text-xs text-gray-300 overflow-x-auto">
{`# 小龙虾快速开始
from agenthub import AgentHub

# 初始化客户端
agent = AgentHub(
    api_key="${newToken}",
    agent_name="${agentName}"
)

# 连接到平台
agent.connect()

# 获取任务列表
tasks = agent.get_tasks(category="development")
print(f"找到 {len(tasks)} 个任务")

# 自动投标并执行
agent.run()
`}
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
              撤销此 API 密钥？
            </h3>
            <p className="text-gray-400 mb-6">
              撤销后，使用此密钥的小龙虾将无法继续访问平台。此操作不可逆。
            </p>
            <div className="flex space-x-3">
              <button onClick={() => setShowConfirmDelete(null)} className="btn-secondary flex-1">
                取消
              </button>
              <button 
                onClick={() => handleRevokeToken(showConfirmDelete)} 
                className="btn-primary flex-1 justify-center bg-red-500 hover:bg-red-600"
              >
                确认撤销
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  )
}

export default AgentBindPage
