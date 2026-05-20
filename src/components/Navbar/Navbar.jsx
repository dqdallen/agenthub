import { Link, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Bot, Menu, X, User, Plus, LayoutDashboard, Zap } from 'lucide-react'
import { useState, useEffect } from 'react'
import { useAuthStore } from '@/store/authStore'
import clsx from 'clsx'
import api from '@/api'
import PointsIcon from '@/components/PointsIcon/PointsIcon'

const navLinks = [
  { path: '/tasks', label: '发现任务', icon: '🔍' },
  { path: '/tasks/create', label: '发布任务', icon: '✨' },
  { path: '/capabilities', label: '能力展示', icon: '🚀' },
  { path: '/agent-connect', label: 'Agent接入', icon: '🤖' },
]

function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const location = useLocation()
  const { user, logout } = useAuthStore()
  const [userPoints, setUserPoints] = useState(0)

  useEffect(() => {
    if (user) {
      fetchUserPoints()
    }
  }, [user])

  const fetchUserPoints = async () => {
    try {
      const response = await api.get('/points/balance')
      if (response.data.success) {
        setUserPoints(response.data.data.points)
      }
    } catch (error) {
      console.error('Failed to fetch points:', error)
    }
  }

  return (
    <motion.nav
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      className="fixed top-0 left-0 right-0 z-50 glass border-b border-white/10"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center space-x-2 group">
            <div className="relative">
              <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-success-500 rounded-xl flex items-center justify-center shadow-lg shadow-primary-500/30 group-hover:shadow-primary-500/50 transition-shadow">
                <Zap className="w-6 h-6 text-white" />
              </div>
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-success-400 rounded-full animate-pulse" />
            </div>
            <span className="font-display font-bold text-xl text-white">
              <span className="gradient-text">aha</span>
            </span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-1">
            {navLinks.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                className={clsx(
                  'px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200',
                  location.pathname === link.path
                    ? 'bg-primary-500/20 text-primary-400'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                )}
              >
                <span className="mr-1.5">{link.icon}</span>
                {link.label}
              </Link>
            ))}
          </div>

          {/* User Actions */}
          <div className="hidden md:flex items-center space-x-3">
            {user ? (
              <>
                <Link
                  to="/dashboard"
                  className="px-4 py-2 text-sm text-gray-300 hover:text-white transition-colors flex items-center"
                >
                  <LayoutDashboard className="w-4 h-4 mr-1.5" />
                  工作台
                </Link>
                <div className="flex items-center px-3 py-1.5 bg-warning-500/10 rounded-lg border border-warning-500/20">
                  <PointsIcon className="w-4 h-4" />
                  <span className="ml-1.5 text-sm font-medium text-warning-400">
                    {userPoints.toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center space-x-2 pl-3 border-l border-white/10">
                  <div className="w-8 h-8 bg-gradient-to-br from-primary-400 to-primary-600 rounded-full flex items-center justify-center">
                    <span className="text-sm font-medium text-white">
                      {user.name?.[0]?.toUpperCase() || 'U'}
                    </span>
                  </div>
                  <span className="text-sm text-gray-300">{user.name}</span>
                  <button
                    onClick={logout}
                    className="ml-2 text-xs text-gray-500 hover:text-red-400 transition-colors"
                  >
                    退出
                  </button>
                </div>
              </>
            ) : (
              <>
                <Link to="/login" className="px-4 py-2 text-sm text-gray-300 hover:text-white transition-colors">
                  登录
                </Link>
                <Link to="/register" className="btn-primary text-sm py-2">
                  立即加入
                </Link>
              </>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden p-2 text-gray-400 hover:text-white"
          >
            {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile Menu */}
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="md:hidden py-4 border-t border-white/10"
          >
            <div className="flex flex-col space-y-2">
              {navLinks.map((link) => (
                <Link
                  key={link.path}
                  to={link.path}
                  onClick={() => setMobileOpen(false)}
                  className={clsx(
                    'px-4 py-3 rounded-lg text-sm font-medium transition-all',
                    location.pathname === link.path
                      ? 'bg-primary-500/20 text-primary-400'
                      : 'text-gray-400 hover:text-white hover:bg-white/5'
                  )}
                >
                  <span className="mr-2">{link.icon}</span>
                  {link.label}
                </Link>
              ))}
              <div className="pt-2 border-t border-white/10">
                {user ? (
                  <div className="flex items-center justify-between px-4">
                    <div className="flex items-center space-x-2">
                      <div className="w-8 h-8 bg-gradient-to-br from-primary-400 to-primary-600 rounded-full flex items-center justify-center">
                        <span className="text-sm font-medium text-white">
                          {user.name?.[0]?.toUpperCase() || 'U'}
                        </span>
                      </div>
                      <span className="text-sm text-gray-300">{user.name}</span>
                    </div>
                    <button onClick={logout} className="text-xs text-red-400">
                      退出
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col space-y-2">
                    <Link
                      to="/login"
                      onClick={() => setMobileOpen(false)}
                      className="px-4 py-3 text-sm text-center text-gray-300 hover:text-white border border-white/10 rounded-lg"
                    >
                      登录
                    </Link>
                    <Link
                      to="/register"
                      onClick={() => setMobileOpen(false)}
                      className="btn-primary text-center text-sm"
                    >
                      立即加入
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </motion.nav>
  )
}

export default Navbar
