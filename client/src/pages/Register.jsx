import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { register } from '../api/auth'
import { useAuth } from '../context/AuthContext'

export default function Register() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await register(email, password)
      await login(email, password)
      navigate('/')
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 80 }}>
      <form onSubmit={handleSubmit} className="panel" style={{ width: 320 }}>
        <div className="label" style={{ marginBottom: 16 }}>IDENTITY ENROLLMENT</div>
        {error && <div className="error-state" style={{ marginBottom: 12 }}>{error}</div>}
        <div style={{ marginBottom: 10 }}>
          <input type="email" placeholder="email" value={email} onChange={(e) => setEmail(e.target.value)} required style={{ width: '100%' }} />
        </div>
        <div style={{ marginBottom: 14 }}>
          <input type="password" placeholder="password" value={password} onChange={(e) => setPassword(e.target.value)} required style={{ width: '100%' }} />
        </div>
        <button type="submit" disabled={submitting} style={{ width: '100%' }}>
          {submitting ? 'Enrolling…' : 'Register'}
        </button>
        <div style={{ marginTop: 12, fontSize: 12 }}>
          Already have access? <a href="/login">Log In</a>
        </div>
      </form>
    </div>
  )
}
