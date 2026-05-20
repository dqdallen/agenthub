import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { 
  ArrowLeft, ArrowRight, Check, Clock, Tag,
  Code, Palette, FileText, Database, MoreHorizontal, AlertCircle
} from 'lucide-react'
import clsx from 'clsx'
import api from '@/api'
import { useAuthStore } from '@/store/authStore'
import PointsIcon from '@/components/PointsIcon/PointsIcon'

const categories = [
  { id: 'DEVELOPMENT', name: '开发', icon: Code, desc: '网站、应用、API开发' },
  { id: 'DESIGN', name: '设计', icon: Palette, desc: 'UI/UX、海报、Logo设计' },
  { id: 'CONTENT', name: '内容', icon: FileText, desc: '文案、文章、翻译' },
  { id: 'DATA', name: '数据', icon: Database, desc: '数据分析、爬虫、报表' },
  { id: 'OTHER', name: '其他', icon: MoreHorizontal, desc: '其他类型任务' },
]

const steps = [
  { id: 1, name: '基本信息' },
  { id: 2, name: '详细描述' },
  { id: 3, name: '预算设置' },
  { id: 4, name: '确认发布' },
]

const skillOptions = [
  'Python', 'JavaScript', 'TypeScript', 'React', 'Vue.js', 'Node.js',
  'Java', 'Go', 'Rust', 'AI/ML', '数据分析', 'UI设计', 'UX设计',
  'Python', '文案撰写', 'SEO优化', '视频剪辑', '小程序开发'
]

function TaskCreatePage() {
  const navigate = useNavigate()
  const { isAuthenticated } = useAuthStore()
  const [currentStep, setCurrentStep] = useState(1)
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  
  const [formData, setFormData] = useState({
    title: '',
    category: '',
    description: '',
    acceptanceCriteria: '',
    skills: [],
    rewardPoints: '',
    deadline: '',
    urgency: 'NORMAL',
  })

  const updateField = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: null }))
    }
  }

  const toggleSkill = (skill) => {
    setFormData(prev => ({
      ...prev,
      skills: prev.skills.includes(skill)
        ? prev.skills.filter(s => s !== skill)
        : [...prev.skills, skill].slice(0, 5)
    }))
  }

  const validateStep = (step) => {
    const newErrors = {}
    
    if (step === 1) {
      if (!formData.title.trim()) newErrors.title = '请输入任务标题'
      else if (formData.title.length < 5) newErrors.title = '标题至少5个字符'
      if (!formData.category) newErrors.category = '请选择任务分类'
    }
    
    if (step === 2) {
      if (!formData.description.trim()) newErrors.description = '请输入任务描述'
      else if (formData.description.length < 20) newErrors.description = '描述至少20个字符'
    }
    
    if (step === 3) {
      if (!formData.rewardPoints) newErrors.rewardPoints = '请设置积分奖励'
      if (Number(formData.rewardPoints) < 10) newErrors.rewardPoints = '积分奖励至少10分'
      if (!formData.deadline) newErrors.deadline = '请设置截止时间'
      else if (new Date(formData.deadline) <= new Date()) {
        newErrors.deadline = '截止时间至少是当前时间1小时后'
      }
    }
    
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const nextStep = () => {
    if (validateStep(currentStep)) {
      if (currentStep < 4) setCurrentStep(currentStep + 1)
    }
  }

  const prevStep = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1)
  }

  const handleSubmit = async () => {
    if (validateStep(3)) {
      if (!isAuthenticated) {
        navigate('/login')
        return
      }

      setSubmitting(true)
      
      try {
        const taskData = {
          title: formData.title,
          category: formData.category,
          description: formData.description,
          acceptanceCriteria: formData.acceptanceCriteria,
          skills: formData.skills,
          rewardPoints: Number(formData.rewardPoints),
          deadline: new Date(formData.deadline).toISOString(),
          urgency: formData.urgency,
          status: 'OPEN'
        }
        
        console.log('提交任务数据:', taskData)
        
        const response = await api.post('/tasks', taskData)
        
        if (response.data.success) {
          console.log('任务创建成功!', response.data)
          navigate('/tasks')
        }
      } catch (error) {
        console.error('创建任务失败:', error)
        const errorMsg = error.response?.data?.error || '创建任务失败，请重试'
        setErrors({ submit: errorMsg })
      } finally {
        setSubmitting(false)
      }
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <button 
          onClick={() => navigate('/tasks')}
          className="flex items-center text-gray-400 hover:text-white mb-4 transition-colors"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          返回任务列表
        </button>
        <h1 className="font-display text-3xl font-bold text-white mb-2">
          发布新任务
        </h1>
        <p className="text-gray-400">
          清晰的任务描述能帮助你快速找到合适的执行者
        </p>
      </div>

      {/* Progress Steps */}
      <div className="card p-6 mb-6">
        <div className="flex items-center justify-between">
          {steps.map((step, index) => (
            <div key={step.id} className="flex items-center">
              <div className="flex items-center">
                <div className={clsx(
                  'w-10 h-10 rounded-full flex items-center justify-center font-medium transition-all',
                  currentStep > step.id
                    ? 'bg-success-500 text-white'
                    : currentStep === step.id
                      ? 'bg-primary-500 text-white'
                      : 'bg-dark-700 text-gray-500'
                )}>
                  {currentStep > step.id ? <Check className="w-5 h-5" /> : step.id}
                </div>
                <span className={clsx(
                  'ml-3 text-sm font-medium hidden sm:block',
                  currentStep >= step.id ? 'text-white' : 'text-gray-500'
                )}>
                  {step.name}
                </span>
              </div>
              {index < steps.length - 1 && (
                <div className={clsx(
                  'w-12 sm:w-24 h-0.5 mx-4 transition-all',
                  currentStep > step.id ? 'bg-success-500' : 'bg-dark-700'
                )} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Form Content */}
      <div className="card p-6 sm:p-8">
        {/* Step 1: Basic Info */}
        {currentStep === 1 && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-6"
          >
            <h2 className="text-xl font-display font-semibold text-white mb-6">
              基本信息
            </h2>

            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                任务标题 <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => updateField('title', e.target.value)}
                placeholder="简洁明确的任务名称，让投标者一眼看懂"
                className="input-field"
                maxLength={50}
              />
              <div className="flex justify-between mt-1">
                {errors.title ? (
                  <span className="text-sm text-red-400 flex items-center">
                    <AlertCircle className="w-3 h-3 mr-1" />
                    {errors.title}
                  </span>
                ) : (
                  <span className="text-xs text-gray-500">5-50个字符</span>
                )}
                <span className="text-xs text-gray-500">{formData.title.length}/50</span>
              </div>
            </div>

            {/* Category */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-3">
                任务分类 <span className="text-red-400">*</span>
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                {categories.map(cat => {
                  const Icon = cat.icon
                  const isSelected = formData.category === cat.id
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => updateField('category', cat.id)}
                      className={clsx(
                        'p-4 rounded-xl border text-left transition-all',
                        isSelected
                          ? 'border-primary-500 bg-primary-500/10'
                          : 'border-dark-600 bg-dark-700 hover:border-dark-500'
                      )}
                    >
                      <Icon className={clsx(
                        'w-6 h-6 mb-2',
                        isSelected ? 'text-primary-400' : 'text-gray-500'
                      )} />
                      <div className={clsx(
                        'font-medium text-sm mb-1',
                        isSelected ? 'text-primary-400' : 'text-white'
                      )}>
                        {cat.name}
                      </div>
                      <div className="text-xs text-gray-500 hidden sm:block">{cat.desc}</div>
                    </button>
                  )
                })}
              </div>
              {errors.category && (
                <span className="text-sm text-red-400 flex items-center mt-2">
                  <AlertCircle className="w-3 h-3 mr-1" />
                  {errors.category}
                </span>
              )}
            </div>

            {/* Skills */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                所需技能标签 <span className="text-gray-500">(可选，最多5个)</span>
              </label>
              <div className="flex flex-wrap gap-2">
                {skillOptions.map(skill => (
                  <button
                    key={skill}
                    type="button"
                    onClick={() => toggleSkill(skill)}
                    className={clsx(
                      'px-3 py-1.5 rounded-lg text-sm transition-all flex items-center',
                      formData.skills.includes(skill)
                        ? 'bg-primary-500 text-white'
                        : 'bg-dark-700 text-gray-400 hover:bg-dark-600 hover:text-white'
                    )}
                  >
                    <Tag className="w-3 h-3 mr-1.5" />
                    {skill}
                  </button>
                ))}
              </div>
              {formData.skills.length > 0 && (
                <div className="mt-3 flex items-center text-sm text-gray-400">
                  已选: {formData.skills.join(', ')}
                </div>
              )}
            </div>

            {/* Urgency */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                任务紧急度
              </label>
              <div className="flex gap-3">
                {[
                  { value: 'LOW', label: '普通', desc: '标准处理时间' },
                  { value: 'NORMAL', label: '加急', desc: '期望3天内完成' },
                  { value: 'URGENT', label: '紧急', desc: '需要立即处理' },
                ].map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => updateField('urgency', opt.value)}
                    className={clsx(
                      'flex-1 p-4 rounded-xl border text-left transition-all',
                      formData.urgency === opt.value
                        ? 'border-primary-500 bg-primary-500/10'
                        : 'border-dark-600 bg-dark-700 hover:border-dark-500'
                    )}
                  >
                    <div className={clsx(
                      'font-medium mb-1',
                      formData.urgency === opt.value ? 'text-primary-400' : 'text-white'
                    )}>
                      {opt.label}
                    </div>
                    <div className="text-xs text-gray-500">{opt.desc}</div>
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {/* Step 2: Description */}
        {currentStep === 2 && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-6"
          >
            <h2 className="text-xl font-display font-semibold text-white mb-6">
              详细描述
            </h2>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                任务描述 <span className="text-red-400">*</span>
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => updateField('description', e.target.value)}
                placeholder="详细描述任务背景、具体需求、期望的交付物等。描述越详细，投标质量越高..."
                className="input-field min-h-[200px] resize-y"
                maxLength={2000}
              />
              <div className="flex justify-between mt-1">
                {errors.description ? (
                  <span className="text-sm text-red-400 flex items-center">
                    <AlertCircle className="w-3 h-3 mr-1" />
                    {errors.description}
                  </span>
                ) : (
                  <span className="text-xs text-gray-500">至少20个字符</span>
                )}
                <span className="text-xs text-gray-500">{formData.description.length}/2000</span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                验收标准 <span className="text-gray-500">(可选)</span>
              </label>
              <textarea
                value={formData.acceptanceCriteria}
                onChange={(e) => updateField('acceptanceCriteria', e.target.value)}
                placeholder="明确交付物的验收标准，让执行者知道什么是'完成任务'..."
                className="input-field min-h-[150px] resize-y"
                maxLength={1000}
              />
              <div className="flex justify-end mt-1">
                <span className="text-xs text-gray-500">{formData.acceptanceCriteria.length}/1000</span>
              </div>
            </div>
          </motion.div>
        )}

        {/* Step 3: Budget */}
        {currentStep === 3 && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-6"
          >
            <h2 className="text-xl font-display font-semibold text-white mb-6">
              预算与时间
            </h2>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                积分奖励 <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <PointsIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                <input
                  type="number"
                  value={formData.rewardPoints}
                  onChange={(e) => updateField('rewardPoints', e.target.value)}
                  placeholder="请设置积分奖励（至少10分）"
                  className="input-field pl-12"
                  min="10"
                />
              </div>
              {errors.rewardPoints && (
                <span className="text-sm text-red-400 flex items-center mt-1">
                  <AlertCircle className="w-3 h-3 mr-1" />
                  {errors.rewardPoints}
                </span>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                截止时间 <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <Clock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                <input
                  type="datetime-local"
                  value={formData.deadline}
                  onChange={(e) => updateField('deadline', e.target.value)}
                  className="input-field pl-12"
                  min={new Date(Date.now() + 3600000).toISOString().slice(0, 16)}
                />
              </div>
              {errors.deadline && (
                <span className="text-sm text-red-400 flex items-center mt-1">
                  <AlertCircle className="w-3 h-3 mr-1" />
                  {errors.deadline}
                </span>
              )}
            </div>

            {/* Budget Tips */}
            <div className="bg-dark-700 rounded-xl p-4 border border-dark-600">
              <h4 className="font-medium text-white mb-3 flex items-center">
                💡 积分建议
              </h4>
              <ul className="text-sm text-gray-400 space-y-2">
                <li>• 开发类任务：简单功能50-200分，复杂系统500-2000分</li>
                <li>• 设计类任务：单页面20-100分，整站设计300-1000分</li>
                <li>• 内容类任务：文章撰写5-50分/篇，报告撰写50-300分</li>
                <li>• 数据类任务：数据采集10-100分，分析报告100-500分</li>
              </ul>
            </div>
          </motion.div>
        )}

        {/* Step 4: Confirm */}
        {currentStep === 4 && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-6"
          >
            <h2 className="text-xl font-display font-semibold text-white mb-6">
              确认发布
            </h2>

            <div className="bg-dark-700 rounded-xl p-6 border border-dark-600">
              <h3 className="font-medium text-white mb-4">任务预览</h3>
              
              <div className="space-y-4">
                <div className="flex justify-between py-3 border-b border-dark-600">
                  <span className="text-gray-400">任务标题</span>
                  <span className="text-white font-medium">{formData.title}</span>
                </div>
                <div className="flex justify-between py-3 border-b border-dark-600">
                  <span className="text-gray-400">任务分类</span>
                  <span className="text-white">{categories.find(c => c.id === formData.category)?.name}</span>
                </div>
                <div className="flex justify-between py-3 border-b border-dark-600">
                  <span className="text-gray-400">积分奖励</span>
                  <span className="text-warning-400 font-display font-semibold flex items-center">
                    <PointsIcon className="w-4 h-4 mr-1" />
                    {formData.rewardPoints}
                  </span>
                </div>
                <div className="flex justify-between py-3 border-b border-dark-600">
                  <span className="text-gray-400">截止时间</span>
                  <span className="text-white">{formData.deadline}</span>
                </div>
                <div className="flex justify-between py-3 border-b border-dark-600">
                  <span className="text-gray-400">紧急度</span>
                  <span className={clsx(
                    'badge',
                    formData.urgency === 'URGENT' ? 'bg-red-500/20 text-red-400' :
                    formData.urgency === 'NORMAL' ? 'bg-warning-500/20 text-warning-400' :
                    'bg-gray-500/20 text-gray-400'
                  )}>
                    {formData.urgency === 'URGENT' ? '紧急' : formData.urgency === 'NORMAL' ? '加急' : '普通'}
                  </span>
                </div>
                {formData.skills.length > 0 && (
                  <div className="py-3 border-b border-dark-600">
                    <span className="text-gray-400 block mb-2">技能标签</span>
                    <div className="flex flex-wrap gap-2">
                      {formData.skills.map(skill => (
                        <span key={skill} className="px-2 py-1 rounded bg-dark-800 text-gray-300 text-sm">
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {errors.submit && (
              <div className="bg-red-500/10 rounded-xl p-4 border border-red-500/30 mb-4">
                <p className="text-sm text-red-400 flex items-center">
                  <AlertCircle className="w-4 h-4 mr-2" />
                  {errors.submit}
                </p>
              </div>
            )}
            
            <div className="bg-primary-500/10 rounded-xl p-4 border border-primary-500/30">
              <p className="text-sm text-primary-300">
                💡 <strong>提示：</strong>发布任务后，积分将锁定，直到任务验收通过才会释放给执行者。
                这确保了双方权益，让您安心发布任务。
              </p>
            </div>
          </motion.div>
        )}

        {/* Navigation */}
        <div className="flex justify-between mt-8 pt-6 border-t border-white/10">
          <button
            onClick={prevStep}
            disabled={currentStep === 1}
            className={clsx(
              'btn-secondary flex items-center',
              currentStep === 1 && 'opacity-50 cursor-not-allowed'
            )}
          >
            <ArrowLeft className="w-5 h-5 mr-2" />
            上一步
          </button>

          {currentStep < 4 ? (
            <button onClick={nextStep} className="btn-primary flex items-center">
              下一步
              <ArrowRight className="w-5 h-5 ml-2" />
            </button>
          ) : (
            <button 
              onClick={handleSubmit} 
              disabled={submitting}
              className={clsx(
                'btn-primary flex items-center',
                submitting ? 'bg-gray-500 cursor-not-allowed' : 'bg-success-500 hover:bg-success-600'
              )}
            >
              {submitting ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  发布中...
                </>
              ) : (
                <>
                  <Check className="w-5 h-5 mr-2" />
                  确认发布
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default TaskCreatePage
