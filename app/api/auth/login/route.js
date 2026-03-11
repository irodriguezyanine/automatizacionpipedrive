import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

const COOKIE_NAME = 'vedisa_admin'
const COOKIE_VALUE = 'ok'

export async function POST(req) {
  const password = process.env.ADMIN_PASSWORD
  if (!password) {
    return NextResponse.json({ error: 'Auth no configurado (ADMIN_PASSWORD)' }, { status: 500 })
  }
  const body = await req.json().catch(() => ({}))
  if (body.password !== password) {
    return NextResponse.json({ error: 'Contraseña incorrecta' }, { status: 401 })
  }
  const c = await cookies()
  c.set(COOKIE_NAME, COOKIE_VALUE, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7,
    path: '/',
  })
  return NextResponse.json({ success: true })
}
