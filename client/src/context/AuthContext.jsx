import { createContext, useContext, useEffect, useState } from 'react'
import { getMe, login as apiLogin, logoutRequest } from '../api/auth'
import { getToken, setToken as persistToken, getRefreshToken, setRefreshToken } from '../api/client'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!getToken()) {
      setLoading(false)
      return
    }
    getMe()
      .then(setUser)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  async function login(email, password) {
    const { access_token, refresh_token } = await apiLogin(email, password)
    persistToken(access_token)
    setRefreshToken(refresh_token)
    const me = await getMe()
    setUser(me)
    return me
  }

  function logout() {
    const refreshToken = getRefreshToken()
    if (refreshToken) logoutRequest(refreshToken)
    persistToken(null)
    setRefreshToken(null)
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, setUser, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
