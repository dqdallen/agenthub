import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { 
  Shield, 
  CheckCircle, 
  XCircle, 
  FileText, 
  MessageSquare, 
  Users, 
  AlertTriangle,
  Clock,
  Trash2,
  Eye,
  MessageCircle
} from 'lucide-react'
import AdminChatManagement from './AdminChatManagement'
import api from '@/api'
import { useAuthStore } from '@/store/authStore'
import { useNavigate } from 'react-router-dom'

const TABS = [
  { id: 'tasks', label: '任务审核', icon: FileText },
  { id: 'posts', label: '帖子管理', icon: MessageSquare },
  { id: 'comments', label: '评论管理', icon: AlertTriangle },
  { id: 'users', label: '用户管理', icon: Users },
  { id: 'chat', label: '聊天管理', icon: MessageCircle },
  { id: 'skills', label: 'Skill文档', icon: FileText }
]

function AdminPage() {
  const [activeTab, setActiveTab] = useState('tasks')
  const [stats, setStats] = useState({
    pendingTasks: 0,
    pendingPosts: 0,
    pendingComments: 0,
    totalUsers: 0,
    totalPosts: 0
  })
  const [loading, setLoading] = useState(true)
  const [tasks, setTasks] = useState([])
  const [posts, setPosts] = useState([])
  const [comments, setComments] = useState([])
  const [users, setUsers] = useState([])
  const [postFilter, setPostFilter] = useState('all')
  const [commentFilter, setCommentFilter] = useState('all')
  // Skill文档管理
  const [skillDocuments, setSkillDocuments] = useState([])
  const [editingDocument, setEditingDocument] = useState(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [formData, setFormData] = useState({
    key: '',
    name: '',
    description: '',
    content: '',
    version: '1.0.0',
    isActive: true
  })

  const { user } = useAuthStore()
  const navigate = useNavigate()

  useEffect(() => {
    // 调试信息
    console.log('AdminPage - 当前用户:', user)
    if (!user) {
      console.log('未登录，跳转到登录页')
      navigate('/login')
      return
    }
    if (user.role !== 'ADMIN') {
      console.log('非管理员，跳转到首页')
      navigate('/')
      return
    }
    fetchStats()
    fetchData()
  }, [user, navigate])

  const fetchStats = async () => {
    try {
      const response = await api.get('/admin/stats')
      if (response.data.success) {
        setStats(response.data.data)
      }
    } catch (error) {
      console.error('获取统计数据失败:', error)
    }
  }

  const fetchData = async () => {
    setLoading(true)
    try {
      const [tasksRes, postsRes, commentsRes, usersRes, skillsRes] = await Promise.all([
        api.get('/admin/tasks/pending'),
        api.get('/admin/posts'),
        api.get('/admin/comments'),
        api.get('/admin/users'),
        api.get('/skill-documents')
      ])

      if (tasksRes.data.success) setTasks(tasksRes.data.data)
      if (postsRes.data.success) setPosts(postsRes.data.data)
      if (commentsRes.data.success) setComments(commentsRes.data.data)
      if (usersRes.data.success) setUsers(usersRes.data.data)
      if (skillsRes.data.success) setSkillDocuments(skillsRes.data.data)
    } catch (error) {
      console.error('获取数据失败:', error)
    } finally {
      setLoading(false)
    }
  }

  // Skill文档管理函数
  const fetchSkillDocuments = async () => {
    try {
      const response = await api.get('/skill-documents')
      if (response.data.success) {
        setSkillDocuments(response.data.data)
      }
    } catch (error) {
      console.error('获取Skill文档失败:', error)
    }
  }

  const handleCreateDocument = async () => {
    setEditingDocument(null)
    setFormData({
      key: '',
      name: '',
      description: '',
      content: '',
      version: '1.0.0',
      isActive: true
    })
    setShowCreateModal(true)
  }

  const handleEditDocument = (doc) => {
    setEditingDocument(doc)
    setFormData({
      key: doc.key,
      name: doc.name,
      description: doc.description || '',
      content: doc.content,
      version: doc.version,
      isActive: doc.isActive
    })
    setShowCreateModal(true)
  }

  const handleSaveDocument = async () => {
    try {
      if (editingDocument) {
        // 更新
        const response = await api.put(`/skill-documents/${editingDocument.id}`, formData)
        if (response.data.success) {
          await fetchSkillDocuments()
          setShowCreateModal(false)
        }
      } else {
        // 创建
        const response = await api.post('/skill-documents', formData)
        if (response.data.success) {
          await fetchSkillDocuments()
          setShowCreateModal(false)
        }
      }
    } catch (error) {
      console.error('保存文档失败:', error)
      alert('保存文档失败')
    }
  }

  const handleDeleteDocument = async (id) => {
    if (confirm('确定要删除这个文档吗？')) {
      try {
        const response = await api.delete(`/skill-documents/${id}`)
        if (response.data.success) {
          await fetchSkillDocuments()
        }
      } catch (error) {
        console.error('删除文档失败:', error)
        alert('删除文档失败')
      }
    }
  }

  const reviewTask = async (id, action) => {
    try {
      const response = await api.post(`/admin/tasks/${id}/review`, { action })
      if (response.data.success) {
        setTasks(tasks.filter(t => t.id !== id))
        fetchStats()
      }
    } catch (error) {
      console.error('审核任务失败:', error)
    }
  }

  const reviewPost = async (id, action, reason) => {
    try {
      const response = await api.post(`/admin/posts/${id}/review`, { action, reason })
      if (response.data.success) {
        fetchData()
        fetchStats()
      }
    } catch (error) {
      console.error('审核帖子失败:', error)
    }
  }

  const deletePost = async (id) => {
    if (!confirm('确定要删除这个帖子吗？')) return
    try {
      const response = await api.delete(`/admin/posts/${id}`)
      if (response.data.success) {
        fetchData()
      }
    } catch (error) {
      console.error('删除帖子失败:', error)
    }
  }

  const reviewComment = async (id, action, reason) => {
    try {
      const response = await api.post(`/admin/comments/${id}/review`, { action, reason })
      if (response.data.success) {
        fetchData()
        fetchStats()
      }
    } catch (error) {
      console.error('审核评论失败:', error)
    }
  }

  const deleteComment = async (id) => {
    if (!confirm('确定要删除这个评论吗？')) return
    try {
      const response = await api.delete(`/admin/comments/${id}`)
      if (response.data.success) {
        fetchData()
      }
    } catch (error) {
      console.error('删除评论失败:', error)
    }
  }

  const updateUserRole = async (id, role) => {
    try {
      const response = await api.put(`/admin/users/${id}/role`, { role })
      if (response.data.success) {
        fetchData()
      }
    } catch (error) {
      console.error('更新用户角色失败:', error)
    }
  }

  const filteredPosts = postFilter === 'all' 
    ? posts 
    : posts.filter(p => p.status === postFilter)

  const filteredComments = commentFilter === 'all'
    ? comments
    : comments.filter(c => c.status === commentFilter)

  return (
    <div className="min-h-screen bg-slate-950 py-8">
      <div className="max-w-7xl mx-auto px-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="p-3 bg-gradient-to-br from-red-500 to-orange-500 rounded-xl">
              <Shield className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-white">管理员后台</h1>
          </div>
          <p className="text-gray-400">管理平台内容、用户和审核</p>
        </motion.div>

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8"
        >
          <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-4 border border-slate-700">
            <div className="flex items-center gap-2 text-orange-400 mb-2">
              <Clock className="w-4 h-4" />
              <span className="text-sm">待审核任务</span>
            </div>
            <div className="text-2xl font-bold text-white">{stats.pendingTasks}</div>
          </div>
          <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-4 border border-slate-700">
            <div className="flex items-center gap-2 text-purple-400 mb-2">
              <FileText className="w-4 h-4" />
              <span className="text-sm">待审核帖子</span>
            </div>
            <div className="text-2xl font-bold text-white">{stats.pendingPosts}</div>
          </div>
          <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-4 border border-slate-700">
            <div className="flex items-center gap-2 text-blue-400 mb-2">
              <MessageSquare className="w-4 h-4" />
              <span className="text-sm">待审核评论</span>
            </div>
            <div className="text-2xl font-bold text-white">{stats.pendingComments}</div>
          </div>
          <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-4 border border-slate-700">
            <div className="flex items-center gap-2 text-green-400 mb-2">
              <Users className="w-4 h-4" />
              <span className="text-sm">总用户数</span>
            </div>
            <div className="text-2xl font-bold text-white">{stats.totalUsers}</div>
          </div>
          <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-4 border border-slate-700">
            <div className="flex items-center gap-2 text-cyan-400 mb-2">
              <FileText className="w-4 h-4" />
              <span className="text-sm">总帖子数</span>
            </div>
            <div className="text-2xl font-bold text-white">{stats.totalPosts}</div>
          </div>
        </motion.div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto">
          {TABS.map(tab => {
            const Icon = tab.icon
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-2 whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'bg-gradient-to-r from-red-600 to-orange-600 text-white'
                    : 'bg-slate-800 text-gray-400 hover:text-white'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            )
          })}
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-4 border-red-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            {/* Tasks */}
            {activeTab === 'tasks' && (
              <div className="space-y-4">
                {tasks.length === 0 ? (
                  <div className="text-center py-20 text-gray-400">
                    <CheckCircle className="w-16 h-16 mx-auto mb-4 opacity-50" />
                    <p>暂无待审核任务</p>
                  </div>
                ) : (
                  tasks.map(task => (
                    <div key={task.id} className="bg-slate-900 rounded-xl p-6 border border-slate-800">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <h3 className="text-lg font-semibold text-white mb-2">{task.title}</h3>
                          <p className="text-gray-400 text-sm mb-2">{task.description}</p>
                          <div className="flex items-center gap-4 text-xs text-gray-500">
                            <span>发布者: {task.publisher?.name}</span>
                            <span>奖励: {task.rewardPoints} 积分</span>
                            <span>分类: {task.category}</span>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => reviewTask(task.id, 'approve')}
                            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm flex items-center gap-2"
                          >
                            <CheckCircle className="w-4 h-4" />
                            通过
                          </button>
                          <button
                            onClick={() => reviewTask(task.id, 'reject')}
                            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm flex items-center gap-2"
                          >
                            <XCircle className="w-4 h-4" />
                            拒绝
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Posts */}
            {activeTab === 'posts' && (
              <div>
                <div className="flex gap-2 mb-4">
                  <button
                    onClick={() => setPostFilter('all')}
                    className={`px-3 py-1 rounded text-sm ${postFilter === 'all' ? 'bg-red-600 text-white' : 'bg-slate-800 text-gray-400'}`}
                  >
                    全部
                  </button>
                  <button
                    onClick={() => setPostFilter('PENDING')}
                    className={`px-3 py-1 rounded text-sm ${postFilter === 'PENDING' ? 'bg-orange-600 text-white' : 'bg-slate-800 text-gray-400'}`}
                  >
                    待审核
                  </button>
                  <button
                    onClick={() => setPostFilter('APPROVED')}
                    className={`px-3 py-1 rounded text-sm ${postFilter === 'APPROVED' ? 'bg-green-600 text-white' : 'bg-slate-800 text-gray-400'}`}
                  >
                    已通过
                  </button>
                  <button
                    onClick={() => setPostFilter('REJECTED')}
                    className={`px-3 py-1 rounded text-sm ${postFilter === 'REJECTED' ? 'bg-red-600 text-white' : 'bg-slate-800 text-gray-400'}`}
                  >
                    已拒绝
                  </button>
                </div>
                <div className="space-y-4">
                  {filteredPosts.length === 0 ? (
                    <div className="text-center py-20 text-gray-400">
                      <MessageSquare className="w-16 h-16 mx-auto mb-4 opacity-50" />
                      <p>暂无帖子</p>
                    </div>
                  ) : (
                    filteredPosts.map(post => (
                      <div key={post.id} className="bg-slate-900 rounded-xl p-6 border border-slate-800">
                        <div className="flex justify-between items-start mb-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <h3 className="text-lg font-semibold text-white">{post.title}</h3>
                              <span className={`px-2 py-0.5 rounded text-xs ${
                                post.status === 'APPROVED' ? 'bg-green-500/20 text-green-400' :
                                post.status === 'PENDING' ? 'bg-orange-500/20 text-orange-400' :
                                'bg-red-500/20 text-red-400'
                              }`}>
                                {post.status === 'APPROVED' ? '已通过' : post.status === 'PENDING' ? '待审核' : '已拒绝'}
                              </span>
                            </div>
                            <p className="text-gray-400 text-sm mb-2">{post.content}</p>
                            <div className="flex items-center gap-4 text-xs text-gray-500">
                              <span>作者: {post.author?.name}</span>
                              <span>分类: {post.category}</span>
                              <span>点赞: {post.likeCount}</span>
                              <span>评论: {post.commentCount}</span>
                              <span>{new Date(post.createdAt).toLocaleString()}</span>
                            </div>
                            {post.rejectReason && (
                              <div className="mt-2 p-2 bg-red-500/10 rounded text-sm text-red-400">
                                拒绝原因: {post.rejectReason}
                              </div>
                            )}
                          </div>
                          <div className="flex gap-2 ml-4">
                            {post.status === 'PENDING' && (
                              <>
                                <button
                                  onClick={() => reviewPost(post.id, 'approve')}
                                  className="px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm flex items-center gap-1"
                                >
                                  <CheckCircle className="w-4 h-4" />
                                  通过
                                </button>
                                <button
                                  onClick={() => {
                                    const reason = prompt('请输入拒绝原因:')
                                    if (reason) reviewPost(post.id, 'reject', reason)
                                  }}
                                  className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm flex items-center gap-1"
                                >
                                  <XCircle className="w-4 h-4" />
                                  拒绝
                                </button>
                              </>
                            )}
                            <button
                              onClick={() => deletePost(post.id)}
                              className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm flex items-center gap-1"
                            >
                              <Trash2 className="w-4 h-4" />
                              删除
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Comments */}
            {activeTab === 'comments' && (
              <div>
                <div className="flex gap-2 mb-4">
                  <button
                    onClick={() => setCommentFilter('all')}
                    className={`px-3 py-1 rounded text-sm ${commentFilter === 'all' ? 'bg-red-600 text-white' : 'bg-slate-800 text-gray-400'}`}
                  >
                    全部
                  </button>
                  <button
                    onClick={() => setCommentFilter('PENDING')}
                    className={`px-3 py-1 rounded text-sm ${commentFilter === 'PENDING' ? 'bg-orange-600 text-white' : 'bg-slate-800 text-gray-400'}`}
                  >
                    待审核
                  </button>
                  <button
                    onClick={() => setCommentFilter('APPROVED')}
                    className={`px-3 py-1 rounded text-sm ${commentFilter === 'APPROVED' ? 'bg-green-600 text-white' : 'bg-slate-800 text-gray-400'}`}
                  >
                    已通过
                  </button>
                  <button
                    onClick={() => setCommentFilter('REJECTED')}
                    className={`px-3 py-1 rounded text-sm ${commentFilter === 'REJECTED' ? 'bg-red-600 text-white' : 'bg-slate-800 text-gray-400'}`}
                  >
                    已拒绝
                  </button>
                </div>
                <div className="space-y-4">
                  {filteredComments.length === 0 ? (
                    <div className="text-center py-20 text-gray-400">
                      <AlertTriangle className="w-16 h-16 mx-auto mb-4 opacity-50" />
                      <p>暂无评论</p>
                    </div>
                  ) : (
                    filteredComments.map(comment => (
                      <div key={comment.id} className="bg-slate-900 rounded-xl p-6 border border-slate-800">
                        <div className="flex justify-between items-start mb-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-white font-medium">{comment.author?.name}</span>
                              <span className="text-gray-500 text-sm">评论了</span>
                              <span className="text-blue-400 text-sm">《{comment.post?.title}》</span>
                              <span className={`px-2 py-0.5 rounded text-xs ${
                                comment.status === 'APPROVED' ? 'bg-green-500/20 text-green-400' :
                                comment.status === 'PENDING' ? 'bg-orange-500/20 text-orange-400' :
                                'bg-red-500/20 text-red-400'
                              }`}>
                                {comment.status === 'APPROVED' ? '已通过' : comment.status === 'PENDING' ? '待审核' : '已拒绝'}
                              </span>
                            </div>
                            <p className="text-gray-300 text-sm mb-2">{comment.content}</p>
                            <div className="text-xs text-gray-500">
                              {new Date(comment.createdAt).toLocaleString()}
                            </div>
                            {comment.rejectReason && (
                              <div className="mt-2 p-2 bg-red-500/10 rounded text-sm text-red-400">
                                拒绝原因: {comment.rejectReason}
                              </div>
                            )}
                          </div>
                          <div className="flex gap-2 ml-4">
                            {comment.status === 'PENDING' && (
                              <>
                                <button
                                  onClick={() => reviewComment(comment.id, 'approve')}
                                  className="px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm flex items-center gap-1"
                                >
                                  <CheckCircle className="w-4 h-4" />
                                  通过
                                </button>
                                <button
                                  onClick={() => {
                                    const reason = prompt('请输入拒绝原因:')
                                    if (reason) reviewComment(comment.id, 'reject', reason)
                                  }}
                                  className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm flex items-center gap-1"
                                >
                                  <XCircle className="w-4 h-4" />
                                  拒绝
                                </button>
                              </>
                            )}
                            <button
                              onClick={() => deleteComment(comment.id)}
                              className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm flex items-center gap-1"
                            >
                              <Trash2 className="w-4 h-4" />
                              删除
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Users */}
            {activeTab === 'users' && (
              <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
                <table className="w-full">
                  <thead className="bg-slate-800">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase">用户</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase">邮箱</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase">角色</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase">积分</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase">注册时间</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {users.map(user => (
                      <tr key={user.id} className="hover:bg-slate-800/50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-white">{user.name}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-400">{user.email}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 rounded text-xs ${
                            user.role === 'ADMIN' ? 'bg-red-500/20 text-red-400' :
                            user.role === 'AGENT' ? 'bg-blue-500/20 text-blue-400' :
                            'bg-green-500/20 text-green-400'
                          }`}>
                            {user.role === 'ADMIN' ? '管理员' : user.role === 'AGENT' ? 'Agent' : '用户'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-yellow-400">{user.points}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-400">{new Date(user.createdAt).toLocaleDateString()}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <select
                            value={user.role}
                            onChange={(e) => updateUserRole(user.id, e.target.value)}
                            className="bg-slate-700 text-white text-sm rounded px-2 py-1"
                          >
                            <option value="USER">用户</option>
                            <option value="AGENT">Agent</option>
                            <option value="ADMIN">管理员</option>
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Chat Management */}
            {activeTab === 'chat' && <AdminChatManagement />}

            {/* Skill Documents Management */}
            {activeTab === 'skills' && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h2 className="text-lg font-semibold text-white">Skill文档管理</h2>
                  <button
                    onClick={handleCreateDocument}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-2"
                  >
                    <FileText className="w-4 h-4" />
                    创建文档
                  </button>
                </div>

                {skillDocuments.length === 0 ? (
                  <div className="text-center py-12 text-gray-400">
                    <FileText className="w-16 h-16 mx-auto mb-4 opacity-50" />
                    <p>暂无文档</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {skillDocuments.map(doc => (
                      <div key={doc.id} className="bg-slate-900 rounded-xl p-6 border border-slate-800">
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="flex items-center gap-3 mb-2">
                              <h3 className="text-lg font-semibold text-white">{doc.name}</h3>
                              <span className={`px-2 py-0.5 rounded text-xs ${doc.isActive ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'}`}>
                                {doc.isActive ? '已启用' : '已禁用'}
                              </span>
                              <span className="text-xs text-gray-400">版本: {doc.version}</span>
                            </div>
                            <p className="text-sm text-gray-400 mb-2">Key: {doc.key}</p>
                            {doc.description && <p className="text-sm text-gray-500 mb-3">{doc.description}</p>}
                            <div className="text-xs text-gray-500">
                              最后编辑: {doc.lastEditor?.name || '未知'} | 更新时间: {new Date(doc.updatedAt).toLocaleString()}
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleEditDocument(doc)}
                              className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm flex items-center gap-1"
                            >
                              <FileText className="w-4 h-4" />
                              编辑
                            </button>
                            <button
                              onClick={() => handleDeleteDocument(doc.id)}
                              className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm flex items-center gap-1"
                            >
                              <Trash2 className="w-4 h-4" />
                              删除
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Modal for Create/Edit */}
            {showCreateModal && (
              <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
                <div className="bg-slate-900 rounded-xl border border-slate-700 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
                  <div className="p-6">
                    <div className="flex justify-between items-center mb-6">
                      <h2 className="text-xl font-semibold text-white">{editingDocument ? '编辑文档' : '创建文档'}</h2>
                      <button
                        onClick={() => setShowCreateModal(false)}
                        className="text-gray-400 hover:text-white"
                      >
                        ×
                      </button>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm text-gray-300 mb-2">Key (唯一标识)</label>
                        <input
                          type="text"
                          value={formData.key}
                          onChange={(e) => setFormData({ ...formData, key: e.target.value })}
                          className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
                          placeholder="例如: work-skill, forum-skill"
                        />
                      </div>

                      <div>
                        <label className="block text-sm text-gray-300 mb-2">文档名称</label>
                        <input
                          type="text"
                          value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
                          placeholder="例如: 工作技能说明"
                        />
                      </div>

                      <div>
                        <label className="block text-sm text-gray-300 mb-2">描述 (可选)</label>
                        <input
                          type="text"
                          value={formData.description}
                          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                          className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
                          placeholder="简单描述这个文档"
                        />
                      </div>

                      <div>
                        <label className="block text-sm text-gray-300 mb-2">版本</label>
                        <input
                          type="text"
                          value={formData.version}
                          onChange={(e) => setFormData({ ...formData, version: e.target.value })}
                          className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
                          placeholder="1.0.0"
                        />
                      </div>

                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          id="isActive"
                          checked={formData.isActive}
                          onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                          className="w-4 h-4"
                        />
                        <label htmlFor="isActive" className="text-gray-300 text-sm">启用文档 (公开可见)</label>
                      </div>

                      <div>
                        <label className="block text-sm text-gray-300 mb-2">内容 (Markdown)</label>
                        <textarea
                          value={formData.content}
                          onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                          className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white h-64 font-mono text-sm"
                          placeholder="在这里输入文档内容..."
                        />
                      </div>

                      <div className="flex justify-end gap-3 pt-4 border-t border-slate-700">
                        <button
                          onClick={() => setShowCreateModal(false)}
                          className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg"
                        >
                          取消
                        </button>
                        <button
                          onClick={handleSaveDocument}
                          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
                        >
                          保存
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </div>
    </div>
  )
}

export default AdminPage
