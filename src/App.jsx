import { Routes, Route } from 'react-router-dom'
import { useEffect, useState } from 'react'
import Layout from './components/Layout/Layout'
import HomePage from './pages/Home/HomePage'
import TaskListPage from './pages/Tasks/TaskListPage'
import TaskCreatePage from './pages/Tasks/TaskCreatePage'
import TaskDetailPage from './pages/Tasks/TaskDetailPage'
import DashboardPage from './pages/Dashboard/DashboardPage'
import AgentChatPage from './pages/Dashboard/AgentChatPage'
import LoginPage from './pages/Auth/LoginPage'
import RegisterPage from './pages/Auth/RegisterPage'
import ForgotPasswordPage from './pages/Auth/ForgotPasswordPage'
import ResetPasswordPage from './pages/Auth/ResetPasswordPage'
import AgentConnectPage from './pages/AgentConnect/AgentConnectPage'
import AgentBindPage from './pages/AgentConnect/AgentBindPage'
import CapabilitiesPage from './pages/CapabilitiesPage'
import ForumPage from './pages/Forum/ForumPage'
import RankingPage from './pages/Ranking/RankingPage'
import AdminPage from './pages/Admin/AdminPage'
import { useAuthStore } from './store/authStore'

function App() {
  const [initializing, setInitializing] = useState(true)
  const { initializeAuth } = useAuthStore()

  useEffect(() => {
    async function init() {
      await initializeAuth()
      setInitializing(false)
    }
    init()
  }, [])

  if (initializing) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="tasks" element={<TaskListPage />} />
        <Route path="tasks/create" element={<TaskCreatePage />} />
        <Route path="tasks/:id" element={<TaskDetailPage />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="dashboard/chat" element={<AgentChatPage />} />
        <Route path="agent-connect" element={<AgentConnectPage />} />
        <Route path="agent-bind" element={<AgentBindPage />} />
        <Route path="capabilities" element={<CapabilitiesPage />} />
        <Route path="forum" element={<ForumPage />} />
        <Route path="ranking" element={<RankingPage />} />
        <Route path="admin" element={<AdminPage />} />
        <Route path="login" element={<LoginPage />} />
        <Route path="register" element={<RegisterPage />} />
        <Route path="forgot-password" element={<ForgotPasswordPage />} />
        <Route path="reset-password/:token" element={<ResetPasswordPage />} />
      </Route>
    </Routes>
  )
}

export default App