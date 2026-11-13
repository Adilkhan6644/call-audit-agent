import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { ProtectedRoute, AdminRoute } from './routes/ProtectedRoute'
import Shell from './components/Shell'
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import Categories from './pages/Categories'
import Instructions from './pages/Instructions'
import Recordings from './pages/Recordings'
import NewAudit from './pages/NewAudit'
import AuditHistory from './pages/AuditHistory'
import AuditDetail from './pages/AuditDetail'
import Usage from './pages/Usage'
import Admin from './pages/Admin'
import AdminApiKeys from './pages/AdminApiKeys'
import AdminAlerts from './pages/AdminAlerts'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route element={<ProtectedRoute />}>
            <Route element={<Shell />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/categories" element={<Categories />} />
              <Route path="/categories/:id/instructions" element={<Instructions />} />
              <Route path="/recordings" element={<Recordings />} />
              <Route path="/audits/new" element={<NewAudit />} />
              <Route path="/audits" element={<AuditHistory />} />
              <Route path="/audits/:id" element={<AuditDetail />} />
              <Route path="/usage" element={<Usage />} />
            </Route>
          </Route>
          <Route element={<AdminRoute />}>
            <Route element={<Shell />}>
              <Route path="/admin" element={<Admin />} />
              <Route path="/admin/api-keys" element={<AdminApiKeys />} />
              <Route path="/admin/alerts" element={<AdminAlerts />} />
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
