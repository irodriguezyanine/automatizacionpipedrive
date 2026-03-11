import { NextResponse } from 'next/server'

const COOKIE_NAME = 'vedisa_admin'

export function middleware(request) {
  const { pathname } = request.nextUrl
  if (pathname.startsWith('/api/auth/login') || pathname.startsWith('/api/auth/logout')) {
    return NextResponse.next()
  }
  if (pathname.startsWith('/dashboard') || pathname.startsWith('/api/activities') || pathname.startsWith('/api/send-email') || pathname.startsWith('/api/complete-activity')) {
    const cookie = request.cookies.get(COOKIE_NAME)?.value
    if (cookie !== 'ok') {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
      }
      const login = new URL('/login', request.url)
      return NextResponse.redirect(login)
    }
  }
  return NextResponse.next()
}

export const config = {
  matcher: ['/dashboard', '/dashboard/:path*', '/api/activities', '/api/send-email', '/api/complete-activity', '/api/auth/login', '/api/auth/logout'],
}
