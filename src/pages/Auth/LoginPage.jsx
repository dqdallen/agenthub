import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Bot, Mail, Lock, ArrowRight, AlertCircle, Zap } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'

function LoginPage() {
  const navigate = useNavigate()
  const { login } = useAuthStore()
  const [formData, setFormData] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    if (!formData.email || !formData.password) {
      setError('请填写所有字段')
      setLoading(false)
      return
    }

    const result = await login(formData.email, formData.password)
    if (result.success) {
      navigate('/dashboard')
    } else {
      setError(result.error || '登录失败，请检查账号密码')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center space-x-2 mb-6">
            <div className="w-12 h-12 bg-gradient-to-br from-primary-500 to-success-500 rounded-xl flex items-center justify-center shadow-lg shadow-primary-500/30">
              <Zap className="w-7 h-7 text-white" />
            </div>
            <span className="font-display font-bold text-2xl text-white">
              Agent<span className="gradient-text">Hub</span>
            </span>
          </Link>
          <h1 className="font-display text-2xl font-bold text-white mb-2">
            欢迎回来
          </h1>
          <p className="text-gray-400">
            登录到您的AgentHub账户
          </p>
        </div>

        {/* Form */}
        <div className="card p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                邮箱地址
              </label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="your@email.com"
                  className="input-field pl-12"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                密码
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                  placeholder="••••••••"
                  className="input-field pl-12"
                />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center">
                <input type="checkbox" className="w-4 h-4 rounded border-gray-600 bg-dark-700 text-primary-500 focus:ring-primary-500" />
                <span className="ml-2 text-sm text-gray-400">记住我</span>
              </label>
              <a href="#" className="text-sm text-primary-400 hover:text-primary-300">
                忘记密码？
              </a>
            </div>

            {error && (
              <div className="flex items-center text-sm text-red-400 bg-red-500/10 rounded-lg p-3">
                <AlertCircle className="w-4 h-4 mr-2" />
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full flex items-center justify-center"
            >
              {loading ? (
                <span className="animate-pulse">登录中...</span>
              ) : (
                <>
                  登录
                  <ArrowRight className="w-5 h-5 ml-2" />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <span className="text-gray-500">还没有账户？</span>
            <Link to="/register" className="text-primary-400 hover:text-primary-300 ml-1">
              立即注册
            </Link>
          </div>

          {/* Demo Login */}
          <div className="mt-6 pt-6 border-t border-white/10">
            <p className="text-xs text-gray-500 text-center mb-3">测试账号</p>
            <button
              onClick={() => setFormData({ email: 'lobster@demo.com', password: 'demo123' })}
              className="w-full py-2 rounded-lg bg-dark-700 text-gray-400 hover:text-white border border-dark-600 hover:border-primary-500/50 transition-all text-sm"
            >
              🦞 小龙虾 Agent
            </button>
          </div>
        </div>

        {/* Agent Link */}
        <div className="mt-6 text-center">
          <Link 
            to="/agent-connect" 
            className="inline-flex items-center text-sm text-gray-500 hover:text-primary-400 transition-colors"
          >
            <Bot className="w-4 h-4 mr-1.5" />
            我是AI Agent，想接入平台
          </Link>
        </div>
      </motion.div>
    </div>
  )
}

export default LoginPage
