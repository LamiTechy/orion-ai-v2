import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import { useAuth } from './context/AuthContext'
import Landing from './pages/Landing'
import Login from './pages/Login'
import Signup from './pages/Signup'
import Chat from './pages/Chat'

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', color: '#6366f1', fontFamily: 'Orbitron, sans-serif' }}>ORION</div>
  return user ? children : <Navigate to="/login" replace />
}

function PublicRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return null
  return user ? <Navigate to="/chat" replace /> : children
}

export default function App() {
  const location = useLocation()

  useEffect(() => {
    const root = document.getElementById('root')
    if (location.pathname === '/chat') {
      root?.classList.add('chat-active')
    } else {
      root?.classList.remove('chat-active')
    }
  }, [location.pathname])

  return (
    <Routes>
      <Route path="/" element={<PublicRoute><Landing /></PublicRoute>} />
      <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
      <Route path="/signup" element={<PublicRoute><Signup /></PublicRoute>} />
      <Route path="/chat" element={<ProtectedRoute><Chat /></ProtectedRoute>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}