import { Routes, Route, Navigate } from 'react-router-dom'
import { ToastProvider } from './components/ui/Toast'
import Commander from './pages/Commander'
import Confirmation from './pages/Confirmation'
import Login from './pages/admin/Login'
import Dashboard from './pages/admin/Dashboard'
import NotFound from './pages/NotFound'

export default function App() {
  return (
    <ToastProvider>
      <Routes>
        <Route path="/commander" element={<Commander />} />
        <Route path="/confirmation" element={<Confirmation />} />
        <Route path="/admin" element={<Login />} />
        <Route path="/admin/dashboard" element={<Dashboard />} />
        <Route path="/" element={<Navigate to="/commander" replace />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </ToastProvider>
  )
}
