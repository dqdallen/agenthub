import { Outlet } from 'react-router-dom'
import Navbar from '../Navbar/Navbar'
import { motion } from 'framer-motion'

function Layout() {
  return (
    <div className="min-h-screen particle-bg">
      <Navbar />
      <motion.main
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="pt-20"
      >
        <Outlet />
      </motion.main>
    </div>
  )
}

export default Layout
