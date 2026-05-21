import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Bot, Mail, Lock, User, ArrowRight, AlertCircle, CheckCircle2, Zap, Send } from 'lucide-react'
import clsx from 'clsx'
import { useAuthStore } from '@/store/authStore'
import api from '@/api/index.js'

function RegisterPage() {
  const navigate = useNavigate()
  const { register } = useAuthStore()
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    name: '',
    verificationCode: '',
  })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)
  const [sendingCode, setSendingCode] = useState(false)
  const [countdown, setCountdown] = useState(0)

  const sendVerificationCode = async () => {
    if (!formData.email) {
      setError('请先输入邮箱地址')
      return
    }

    setSendingCode(true)
    try {
      await api.post('/auth/send-verification-code', { email: formData.email })
      setCountdown(60)
      const timer = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            clearInterval(timer)
            return 0
          }
          return prev - 1
        })
      }, 1000)
    } catch (e) {
      setError(e.response?.data?.error || '发送验证码失败')
    } finally {
      setSendingCode(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    if (!formData.email || !formData.password || !formData.name || !formData.verificationCode) {
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

    const result = await register({
      email: formData.email,
      password: formData.password,
      name: formData.name,
      verificationCode: formData.verificationCode,
    })

    if (result.success) {
      setSuccess(true)
      setTimeout(() => {
        navigate('/')
      }, 1000)
    } else {
      setError(result.error || '注册失败，请稍后重试')
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
              <span className="gradient-text">AHA</span>
            </span>
          </Link>
          <h1 className="font-display text-2xl font-bold text-white mb-2">
            创建账户
          </h1>
          <p className="text-gray-400">
            加入AHA，开启AI任务之旅
          </p>
        </div>

        {/* Form */}
        <div className="card p-8">
          {success ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center py-8"
            >
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-success-500/20 flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8 text-success-400" />
              </div>
              <h2 className="text-xl font-bold text-white mb-2">注册成功！</h2>
              <p className="text-gray-400">正在跳转到首页...</p>
            </motion.div>
          ) : (
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

              {/* Verification Code */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  验证码 <span className="text-red-400">*</span>
                </label>
                <div className="flex gap-3">
                  <div className="relative flex-1">
                    <Send className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                    <input
                      type="text"
                      value={formData.verificationCode}
                      onChange={(e) => setFormData(prev => ({ ...prev, verificationCode: e.target.value }))}
                      placeholder="输入验证码"
                      className="input-field pl-12"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={sendVerificationCode}
                    disabled={sendingCode || countdown > 0}
                    className={clsx(
                      'px-4 py-2 rounded-lg text-sm font-medium transition-all',
                      countdown > 0
                        ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                        : 'bg-primary-500 text-white hover:bg-primary-400'
                    )}
                  >
                    {countdown > 0 ? `${countdown}s` : sendingCode ? '发送中...' : '发送验证码'}
                  </button>
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
          )}

          {!success && (
            <div className="mt-6 text-center">
              <span className="text-gray-500">已有账户？</span>
              <Link to="/login" className="text-primary-400 hover:text-primary-300 ml-1">
                立即登录
              </Link>
            </div>
          )}
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
