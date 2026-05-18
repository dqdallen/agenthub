import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Bot, Mail, Lock, User, ArrowRight, AlertCircle, CheckCircle2, Zap } from 'lucide-react'
import clsx from 'clsx'

function RegisterPage() {
  const navigate = useNavigate()
  const [formData, setFormData] = useState({ 
    email: '', 
    password: '', 
    confirmPassword: '',
    name: '',
    role: 'worker',
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    if (!formData.email || !formData.password || !formData.name) {
      setError('请填写所有必填字段')
      setLoading(false)
      return
    }

    if (formData.password !== formData.confirmPassword) {
      setError('两次密码输入不一致')
      setLoading(false)
      return
    }

    if (formData.password.length < 6) {
      setError('密码至少6个字符')
      setLoading(false)
      return
    }

    setTimeout(() => {
      console.log('注册成功:', formData)
      navigate('/login')
      setLoading(false)
    }, 1500)
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
            创建账户
          </h1>
          <p className="text-gray-400">
            加入AgentHub，开启AI任务之旅
          </p>
        </div>

        {/* Form */}
        <div className="card p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                昵称 <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="您的昵称"
                  className="input-field pl-12"
                />
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                邮箱地址 <span className="text-red-400">*</span>
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

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                密码 <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                  placeholder="至少6个字符"
                  className="input-field pl-12"
                />
              </div>
            </div>

            {/* Confirm Password */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                确认密码 <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                <input
                  type="password"
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                  placeholder="再次输入密码"
                  className="input-field pl-12"
                />
              </div>
            </div>

            {/* Role */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-3">
                注册类型 <span className="text-gray-500">(选择您的角色)</span>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, role: 'worker' }))}
                  className={clsx(
                    'p-4 rounded-xl border text-left transition-all',
                    formData.role === 'worker'
                      ? 'border-primary-500 bg-primary-500/10'
                      : 'border-dark-600 bg-dark-700 hover:border-dark-500'
                  )}
                >
                  <div className={clsx(
                    'font-medium mb-1',
                    formData.role === 'worker' ? 'text-primary-400' : 'text-white'
                  )}>
                    我想接任务
                  </div>
                  <div className="text-xs text-gray-500">
                    作为接包者完成任务赚取收益
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, role: 'employer' }))}
                  className={clsx(
                    'p-4 rounded-xl border text-left transition-all',
                    formData.role === 'employer'
                      ? 'border-primary-500 bg-primary-500/10'
                      : 'border-dark-600 bg-dark-700 hover:border-dark-500'
                  )}
                >
                  <div className={clsx(
                    'font-medium mb-1',
                    formData.role === 'employer' ? 'text-primary-400' : 'text-white'
                  )}>
                    我要发任务
                  </div>
                  <div className="text-xs text-gray-500">
                    发布任务找到合适的执行者
                  </div>
                </button>
              </div>
            </div>

            {/* Terms */}
            <div className="flex items-start">
              <input 
                type="checkbox" 
                id="terms"
                className="w-4 h-4 mt-0.5 rounded border-gray-600 bg-dark-700 text-primary-500 focus:ring-primary-500"
              />
              <label htmlFor="terms" className="ml-2 text-sm text-gray-400">
                我已阅读并同意 <a href="#" className="text-primary-400 hover:underline">服务条款</a> 和 <a href="#" className="text-primary-400 hover:underline">隐私政策</a>
              </label>
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
                <span className="animate-pulse">创建账户中...</span>
              ) : (
                <>
                  创建账户
                  <ArrowRight className="w-5 h-5 ml-2" />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <span className="text-gray-500">已有账户？</span>
            <Link to="/login" className="text-primary-400 hover:text-primary-300 ml-1">
              立即登录
            </Link>
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

export default RegisterPage
