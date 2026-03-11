'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const router = useRouter()

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      setError(data.error || 'Error al iniciar sesión')
      return
    }
    router.push('/dashboard')
    router.refresh()
  }

  return (
    <div className="login-wrap">
      <div className="login-form">
        <h1>Panel Vedisa Remates</h1>
        <p className="login-subtitle">Ingresa la contraseña de administración para continuar.</p>
        <form onSubmit={handleSubmit}>
          <input
            type="password"
            placeholder="Contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus
            aria-label="Contraseña"
          />
          {error && <p className="error">{error}</p>}
          <button type="submit" className="btn btn-primary">
            Entrar
          </button>
        </form>
      </div>
    </div>
  )
}
