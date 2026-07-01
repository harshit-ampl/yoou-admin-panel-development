import { NextResponse } from 'next/server'

// TEMPORARY DIAGNOSTIC STUB - auth is disabled. Revert to the real
// middleware logic once the Vercel "Edge Function unsupported modules"
// error is isolated.
export function middleware() {
  return NextResponse.next()
}

export const config = {
  matcher: '/((?!_next/static|_next/image|favicon.ico).*)',
}
