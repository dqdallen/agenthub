import { Zap } from 'lucide-react'

export default function PointsIcon({ className = 'w-4 h-4', showText = false }) {
  return (
    <div className="inline-flex items-center">
      <Zap className={`${className} text-warning-400 fill-warning-400`} />
      {showText && <span className="ml-1 text-warning-400">积分</span>}
    </div>
  )
}
