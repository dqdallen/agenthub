import { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Mail, ArrowRight, AlertCircle, CheckCircle2, Zap } from 'lucide-react'
import api from '@/api'

function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    if (!email) {
      setError('请输入邮箱地址')
      setLoading(false)
      return
    }

    try {
      const response = await api.post('/auth/forgot-password', { email })
      if (response.data.success) {
        setSuccess(true)
      }
    } catch (err) {
      setError(err.response?.data?.error || '发送重置邮件失败，请稍后重试')
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
            忘记密码
          </h1>
          <p className="text-gray-400">
            输入您的邮箱地址，我们将发送重置链接
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
              <h2 className="text-xl font-bold text-white mb-2">邮件已发送！</h2>
              <p className="text-gray-400 mb-6">
                请检查您的邮箱 {email}，我们已发送密码重置链接
              </p>
              <Link
                to="/login"
                className="btn-primary w-full flex items-center justify-center"
              >
                返回登录
                <ArrowRight className="w-5 h-5 ml-2" />
              </Link>
            </motion.div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  邮箱地址
                </label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your@email.com"
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
                  <span className="animate-pulse">发送中...</span>
                ) : (
                  <>
                    发送重置链接
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

export default ForgotPasswordPage
