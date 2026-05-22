import { useState, useEffect, useRef } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Search, Filter, Plus, Code, Palette, FileText, Database, MoreHorizontal, X, SlidersHorizontal, Loader2 } from 'lucide-react'
import TaskCard from '@/components/TaskCard/TaskCard'
import clsx from 'clsx'
import api from '@/api'

const categories = [
  { id: '', name: '全部分类', icon: null },
  { id: 'DEVELOPMENT', name: '开发', icon: Code },
  { id: 'DESIGN', name: '设计', icon: Palette },
  { id: 'CONTENT', name: '内容', icon: FileText },
  { id: 'DATA', name: '数据', icon: Database },
  { id: 'OTHER', name: '其他', icon: MoreHorizontal },
]

const sortOptions = [
  { value: 'newest', label: '最新发布' },
  { value: 'budget', label: '积分最高' },
]

const ITEMS_PER_PAGE = 12

function TaskListPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [showFilters, setShowFilters] = useState(false)
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [total, setTotal] = useState(0)
  const abortControllerRef = useRef(null)
  
  const [filters, setFilters] = useState({
    category: '',
    search: '',
    sort: 'newest',
    page: 1,
  })

  // 同步 URL 参数到 filters
  useEffect(() => {
    const cat = searchParams.get('category') || ''
    const search = searchParams.get('search') || ''
    const page = parseInt(searchParams.get('page') || '1')
    const sort = searchParams.get('sort') || 'newest'
    
    setFilters({
      category: cat,
      search: search,
      page: page,
      sort: sort,
    })
  }, [searchParams])

  // 获取任务列表
  useEffect(() => {
    const fetchTasks = async () => {
      // 取消之前的请求
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
      
      const abortController = new AbortController()
      abortControllerRef.current = abortController
      
      setLoading(true)
      setError(null)
      
      try {
        // 手动构建 URL 字符串，使用 encodeURIComponent 正确编码每个参数！
        let url = '/tasks?status=OPEN&limit=' + ITEMS_PER_PAGE + '&page=' + filters.page
        
        if (filters.category) {
          url += '&category=' + encodeURIComponent(filters.category)
        }
        if (filters.search) {
          url += '&search=' + encodeURIComponent(filters.search)
        }
        if (filters.sort) {
          url += '&sort=' + encodeURIComponent(filters.sort)
        }

        console.log('Fetching tasks with URL:', url)
        
        const response = await api.get(url, {
          signal: abortController.signal
        })
        
        if (response.data && Array.isArray(response.data.data)) {
          setTasks(response.data.data)
          setTotal(response.data.pagination?.total || response.data.data.length)
        } else {
          setTasks([])
          setTotal(0)
        }
      } catch (err) {
        if (err.name === 'CanceledError' || err.name === 'AbortError') {
          console.log('Request cancelled')
          return
        }
        
        console.error('获取任务失败:', err)
        
        if (err.code === 'ECONNREFUSED') {
          setError('无法连接到服务器')
        } else if (err.response?.status === 400) {
          const errorMsg = err.response?.data?.error || '请检查筛选条件'
          setError(`请求参数错误: ${errorMsg}`)
        } else {
          setError(err.message || '网络错误，请稍后重试')
        }
      } finally {
        setLoading(false)
      }
    }

    fetchTasks()
  }, [filters])

  const resetFilters = () => {
    setFilters({
      category: '',
      search: '',
      sort: 'newest',
      page: 1,
    })
    setSearchParams({})
  }

  const handleCategoryClick = (catId) => {
    const newFilters = { ...filters, category: catId, page: 1 }
    setFilters(newFilters)
    if (catId) {
      setSearchParams({ category: catId })
    } else {
      setSearchParams({})
    }
  }

  const handleSearch = (value) => {
    const newFilters = { ...filters, search: value, page: 1 }
    setFilters(newFilters)
    if (value) {
      setSearchParams({ search: value })
    } else {
      setSearchParams({})
    }
  }

  const handleSortChange = (value) => {
    const newFilters = { ...filters, sort: value, page: 1 }
    setFilters(newFilters)
    const params = {}
    if (filters.category) params.category = filters.category
    if (filters.search) params.search = filters.search
    params.sort = value
    setSearchParams(params)
  }

  const handlePageChange = (newPage) => {
    const newFilters = { ...filters, page: newPage }
    setFilters(newFilters)
    const params = {}
    if (filters.category) params.category = filters.category
    if (filters.search) params.search = filters.search
    if (newPage > 1) params.page = newPage.toString()
    setSearchParams(params)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const totalPages = Math.ceil(total / ITEMS_PER_PAGE) || 1

  const getPageNumbers = () => {
    const pages = []
    const maxVisible = 5
    
    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i)
      }
    } else {
      if (filters.page <= 3) {
        for (let i = 1; i <= 4; i++) pages.push(i)
        pages.push('...')
        pages.push(totalPages)
      } else if (filters.page >= totalPages - 2) {
        pages.push(1)
        pages.push('...')
        for (let i = totalPages - 3; i <= totalPages; i++) pages.push(i)
      } else {
        pages.push(1)
        pages.push('...')
        for (let i = filters.page - 1; i <= filters.page + 1; i++) pages.push(i)
        pages.push('...')
        pages.push(totalPages)
      }
    }
    
    return pages
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="font-display text-3xl font-bold text-white mb-2">
            发现任务
          </h1>
          <p className="text-gray-400">
            找到适合你的AI任务，赚取积分
          </p>
        </div>
        <Link to="/tasks/create" className="btn-primary flex items-center">
          <Plus className="w-5 h-5 mr-2" />
          发布任务
        </Link>
      </div>

      {/* Search & Filter Bar */}
      <div className="card p-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
            <input
              type="text"
              placeholder="搜索任务标题或描述..."
              value={filters.search}
              onChange={(e) => handleSearch(e.target.value)}
              className="input-field pl-12"
            />
          </div>

          {/* Sort */}
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-5 h-5 text-gray-500" />
            <select
              value={filters.sort}
              onChange={(e) => handleSortChange(e.target.value)}
              className="input-field w-auto pr-10"
            >
              {sortOptions.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          {/* Filter Toggle */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={clsx(
              'px-4 py-3 rounded-xl border transition-all',
              showFilters 
                ? 'bg-primary-500/20 border-primary-500 text-primary-400' 
                : 'bg-dark-700 border-dark-600 text-gray-400 hover:text-white'
            )}
          >
            <Filter className="w-5 h-5" />
          </button>
        </div>

        {/* Filters */}
        {showFilters && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="mt-4 pt-4 border-t border-white/10"
          >
            <div className="flex flex-wrap gap-2">
              <span className="text-sm text-gray-500 mr-2">技能:</span>
              {['Python', 'JavaScript', 'React', 'Node.js', 'AI/ML', '设计'].map(skill => (
                <button
                  key={skill}
                  onClick={() => handleSearch(skill)}
                  className={clsx(
                    'px-3 py-1.5 rounded-lg text-sm transition-all',
                    filters.search === skill
                      ? 'bg-primary-500 text-white'
                      : 'bg-dark-700 text-gray-400 hover:bg-dark-600'
                  )}
                >
                  {skill}
                </button>
              ))}
            </div>
            <div className="flex items-center justify-end mt-4">
              <button
                onClick={resetFilters}
                className="text-sm text-primary-400 hover:text-primary-300"
              >
                重置筛选
              </button>
            </div>
          </motion.div>
        )}
      </div>

      {/* Categories */}
      <div className="flex flex-wrap gap-2 mb-8">
        {categories.map(cat => {
          const Icon = cat.icon
          const isActive = filters.category === cat.id
          return (
            <button
              key={cat.id}
              onClick={() => handleCategoryClick(cat.id)}
              className={clsx(
                'px-4 py-2 rounded-xl text-sm font-medium transition-all flex items-center',
                isActive
                  ? 'bg-primary-500 text-white'
                  : 'bg-dark-800 text-gray-400 hover:bg-dark-700 hover:text-white border border-dark-700'
              )}
            >
              {Icon && <Icon className="w-4 h-4 mr-2" />}
              {cat.name}
            </button>
          )
        })}
      </div>

      {/* Results */}
      <div className="flex items-center justify-between mb-6">
        <p className="text-gray-400">
          {loading ? (
            <span className="flex items-center">
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              加载中...
            </span>
          ) : (
            <>共找到 <span className="text-white font-medium">{total}</span> 个任务</>
          )}
        </p>
        {(filters.category || filters.search) && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">筛选条件:</span>
            {filters.category && (
              <span className="inline-flex items-center px-2 py-1 rounded bg-primary-500/20 text-primary-400 text-xs">
                {categories.find(c => c.id === filters.category)?.name}
                <X 
                  className="w-3 h-3 ml-1 cursor-pointer" 
                  onClick={() => handleCategoryClick('')}
                />
              </span>
            )}
            {filters.search && (
              <span className="inline-flex items-center px-2 py-1 rounded bg-primary-500/20 text-primary-400 text-xs">
                "{filters.search}"
                <X 
                  className="w-3 h-3 ml-1 cursor-pointer" 
                  onClick={() => handleSearch('')}
                />
              </span>
            )}
          </div>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="card p-4 mb-6 bg-red-500/10 border-red-500/30"
        >
          <p className="text-red-400 text-center">{error}</p>
          <button
            onClick={() => setFilters({ ...filters })} // 触发重新渲染和请求
            className="mt-2 text-sm text-red-400 hover:text-red-300 underline"
          >
            点击重试
          </button>
        </motion.div>
      )}

      {/* Loading State */}
      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="card p-6 animate-pulse">
              <div className="h-4 bg-dark-700 rounded w-3/4 mb-4"></div>
              <div className="h-3 bg-dark-700 rounded w-full mb-2"></div>
              <div className="h-3 bg-dark-700 rounded w-2/3 mb-4"></div>
              <div className="flex gap-2 mb-4">
                <div className="h-6 bg-dark-700 rounded w-16"></div>
                <div className="h-6 bg-dark-700 rounded w-16"></div>
              </div>
              <div className="h-10 bg-dark-700 rounded w-full"></div>
            </div>
          ))}
        </div>
      ) : tasks.length > 0 ? (
        <>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {tasks.map((task, index) => (
              <TaskCard key={task.id} task={task} index={index} />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-12 flex justify-center">
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => handlePageChange(filters.page - 1)}
                  disabled={filters.page <= 1}
                  className="px-4 py-2 rounded-lg bg-dark-800 text-gray-400 border border-dark-700 hover:bg-dark-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  上一页
                </button>
                
                {getPageNumbers().map((page, index) => (
                  page === '...' ? (
                    <span key={`ellipsis-${index}`} className="px-2 text-gray-500">...</span>
                  ) : (
                    <button
                      key={page}
                      onClick={() => handlePageChange(page)}
                      className={clsx(
                        'px-4 py-2 rounded-lg border transition-colors',
                        filters.page === page
                          ? 'bg-primary-500 text-white border-primary-500'
                          : 'bg-dark-800 text-gray-400 border-dark-700 hover:bg-dark-700'
                      )}
                    >
                      {page}
                    </button>
                  )
                ))}
                
                <button
                  onClick={() => handlePageChange(filters.page + 1)}
                  disabled={filters.page >= totalPages}
                  className="px-4 py-2 rounded-lg bg-dark-800 text-gray-400 border border-dark-700 hover:bg-dark-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  下一页
                </button>
              </div>
            </div>
          )}
        </>
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="card p-16 text-center"
        >
          <div className="w-16 h-16 bg-dark-700 rounded-full flex items-center justify-center mx-auto mb-4">
            <Search className="w-8 h-8 text-gray-600" />
          </div>
          <h3 className="text-xl font-medium text-white mb-2">没有找到匹配的任务</h3>
          <p className="text-gray-400 mb-6">试试调整筛选条件或搜索关键词</p>
          <button
            onClick={resetFilters}
            className="btn-secondary"
          >
            清除筛选
          </button>
        </motion.div>
      )}
    </div>
  )
}

export default TaskListPage
