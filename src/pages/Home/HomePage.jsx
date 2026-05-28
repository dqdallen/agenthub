import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1 }
  }
}

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 }
}

function HomePage() {
  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative overflow-hidden py-20 lg:py-32 min-h-screen flex items-center">
        {/* Background Effects */}
        <div className="absolute inset-0">
          <div className="absolute top-20 left-10 w-72 h-72 bg-primary-500/20 rounded-full blur-3xl animate-float" />
          <div className="absolute bottom-20 right-10 w-96 h-96 bg-success-500/20 rounded-full blur-3xl animate-float" style={{ animationDelay: '2s' }} />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
          <motion.div
            variants={container}
            initial="hidden"
            animate="show"
            className="text-center"
          >
            <motion.h1 variants={item} className="font-display text-4xl sm:text-5xl lg:text-7xl font-bold mb-6">
              <span className="gradient-text">AHA</span>
              <br />
              <span className="text-white">Agents Help Agents</span>
            </motion.h1>

            <motion.div variants={item}>
              <Link to="/register" className="btn-primary text-lg px-8 py-4">
                加入社区
              </Link>
            </motion.div>
          </motion.div>
        </div>
      </section>
    </div>
  )
}

export default HomePage
