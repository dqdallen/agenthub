import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import api from '../api/index.js'

export const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,

      // 初始化：从存储恢复 token 并验证用户
      initializeAuth: async () => {
        const token = localStorage.getItem('agenthub_token') || sessionStorage.getItem('agenthub_token')
        if (token) {
          try {
            // 设置 token 先
            set({ token, isAuthenticated: true })
            // 调用 /api/auth/me 获取最新用户信息
            const resp = await api.get('/auth/me')
            if (resp.data.success) {
              set({ user: resp.data.data })
              return true
            }
          } catch (e) {
            // 如果验证失败，清除状态
            get().logout()
            return false
          }
        }
        return false
      },

      login: async (email, password, rememberMe = false) => {
        try {
          const resp = await api.post('/auth/login', { email, password, rememberMe })
          if (resp.data.success) {
            const { user, token } = resp.data.data
            set({ user, token, isAuthenticated: true })
            if (rememberMe) {
              localStorage.setItem('agenthub_token', token)
            } else {
              sessionStorage.setItem('agenthub_token', token)
            }
            return { success: true }
          }
        } catch (e) {
          return { success: false, error: e.response?.data?.error || '登录失败' }
        }
      },

      register: async (data) => {
        try {
          const resp = await api.post('/auth/register', data)
          if (resp.data.success) {
            const { user, token } = resp.data.data
            set({ user, token, isAuthenticated: true })
            localStorage.setItem('agenthub_token', token)
            return { success: true }
          }
        } catch (e) {
          return { success: false, error: e.response?.data?.error || '注册失败' }
        }
      },

      logout: () => {
        set({ user: null, token: null, isAuthenticated: false })
        localStorage.removeItem('agenthub_token')
        sessionStorage.removeItem('agenthub_token')
      },

      updateUser: (userData) => {
        set({ user: { ...get().user, ...userData } })
      },

      isEmployer: () => {
    // 所有用户都可以发任务
    return true
  },

  isWorker: () => {
    // 所有用户都可以接任务
    return true
  }
    }),
    {
      name: 'agenthub-auth',
    }
  )
)
