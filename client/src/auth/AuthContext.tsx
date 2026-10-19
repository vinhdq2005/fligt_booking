import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { getMe, logout as logoutRequest } from './authApi'
import type { CurrentUser } from './authApi'

type AuthContextValue = {
  user: CurrentUser | null
  loading: boolean
  setUser: (user: CurrentUser | null) => void
  logout: () => Promise<void>
}
const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    getMe().then(({ user }) => { if (active) setUser(user) }).catch(() => { if (active) setUser(null) }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  async function logout() {
    await logoutRequest()
    setUser(null)
  }

  return <AuthContext.Provider value={{ user, loading, setUser, logout }}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('AuthProvider chưa được khởi tạo')
  return context
}
