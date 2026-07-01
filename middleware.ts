import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Routes that don't require authentication
const PUBLIC_PATHS = new Set(['/login', '/api/sign-in'])

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Always allow public paths
  if (PUBLIC_PATHS.has(pathname)) {
    return NextResponse.next()
  }

  const token = request.cookies.get('token')?.value

  // No httpOnly cookie → block API calls entirely (returns 401, not a redirect)
  if (!token && pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })
  }

  // No cookie on a page route → redirect to login
  if (!token) {
    const loginUrl = new URL('/login', request.url)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: '/((?!_next/static|_next/image|favicon.ico).*)',
}
