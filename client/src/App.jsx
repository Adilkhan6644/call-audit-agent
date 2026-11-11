import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { ProtectedRoute, AdminRoute } from './routes/ProtectedRoute'
import Shell from './components/Shell'
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import Categories from './pages/Categories'
import Instructions from './pages/Instructions'

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
            </Route>
          </Route>
          <Route element={<AdminRoute />}>
            <Route element={<Shell />}>{/* admin pages added in a later phase */}</Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
