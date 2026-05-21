import { useState, useEffect } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Lock, ArrowRight, AlertCircle, CheckCircle2, Zap } from 'lucide-react'
import api from '@/api'

function ResetPasswordPage() {
  const { token } = useParams()
  const navigate = useNavigate()
  const [formData, setFormData] = useState({ password: '', confirmPassword: '' })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)
  const [tokenValid, setTokenValid] = useState(true)

  useEffect(() => {
    // 验证token是否有效
    const validateToken = async () => {
      try {
        const response = await api.get(`/auth/verify-reset-token/${token}`)
        if (!response.data.success) {
          setTokenValid(false)
          setError('重置链接无效或已过期')
        }
      } catch (err) {
        setTokenValid(false)
        setError('重置链接无效或已过期')
      }
    }
    validateToken()
  }, [token])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    if (!formData.password || !formData.confirmPassword) {
      setError('请填写所有字段')
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

    try {
      const response = await api.post(`/auth/reset-password/${token}`, {
        password: formData.password
      })
      if (response.data.success) {
        setSuccess(true)
      }
    } catch (err) {
      setError(err.response?.data?.error || '重置密码失败，请稍后重试')
    } finally {
      setLoading(false)
    }
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
            重置密码
          </h1>
          <p className="text-gray-400">
            输入您的新密码
          </p>
        </div>

        {/* Form */}
        <div className="card p-8">
          {!tokenValid ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center py-8"
            >
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-500/20 flex items-center justify-center">
                <AlertCircle className="w-8 h-8 text-red-400" />
              </div>
              <h2 className="text-xl font-bold text-white mb-2">链接无效</h2>
              <p className="text-gray-400 mb-6">
                该重置链接无效或已过期，请重新请求重置密码
              </p>
              <Link
                to="/forgot-password"
                className="btn-primary w-full flex items-center justify-center"
              >
                重新请求
                <ArrowRight className="w-5 h-5 ml-2" />
              </Link>
            </motion.div>
          ) : success ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center py-8"
            >
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-success-500/20 flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8 text-success-400" />
              </div>
              <h2 className="text-xl font-bold text-white mb-2">密码重置成功！</h2>
              <p className="text-gray-400 mb-6">
                您的密码已更新，请使用新密码登录
              </p>
              <Link
                to="/login"
                className="btn-primary w-full flex items-center justify-center"
              >
                去登录
                <ArrowRight className="w-5 h-5 ml-2" />
              </Link>
            </motion.div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  新密码 <span className="text-red-400">*</span>
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

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  确认新密码 <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                  <input
                    type="password"
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                    placeholder="再次输入新密码"
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
                  <span className="animate-pulse">重置中...</span>
                ) : (
                  <>
                    重置密码
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </>
                )}
              </button>
            </form>
          )}

          <div className="mt-6 text-center">
            <Link to="/login" className="text-primary-400 hover:text-primary-300">
              ← 返回登录
            </Link>
          </div>
        </div>
      </motion.div>
    </div>
  )
}

export default ResetPasswordPage
