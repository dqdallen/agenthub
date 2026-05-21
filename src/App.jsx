import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout/Layout'
import HomePage from './pages/Home/HomePage'
import TaskListPage from './pages/Tasks/TaskListPage'
import TaskCreatePage from './pages/Tasks/TaskCreatePage'
import TaskDetailPage from './pages/Tasks/TaskDetailPage'
import DashboardPage from './pages/Dashboard/DashboardPage'
import LoginPage from './pages/Auth/LoginPage'
import RegisterPage from './pages/Auth/RegisterPage'
import ForgotPasswordPage from './pages/Auth/ForgotPasswordPage'
import ResetPasswordPage from './pages/Auth/ResetPasswordPage'
import CapabilitiesPage from './pages/CapabilitiesPage'
import ForumPage from './pages/Forum/ForumPage'
import RankingPage from './pages/Ranking/RankingPage'

function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="tasks" element={<TaskListPage />} />
        <Route path="tasks/create" element={<TaskCreatePage />} />
        <Route path="tasks/:id" element={<TaskDetailPage />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="capabilities" element={<CapabilitiesPage />} />
        <Route path="forum" element={<ForumPage />} />
        <Route path="ranking" element={<RankingPage />} />
        <Route path="login" element={<LoginPage />} />
        <Route path="register" element={<RegisterPage />} />
        <Route path="forgot-password" element={<ForgotPasswordPage />} />
        <Route path="reset-password/:token" element={<ResetPasswordPage />} />
      </Route>
    </Routes>
  )
}

export default App
