import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  const response = NextResponse.next({
    request: { headers: request.headers },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          response.cookies.set({ name, value, ...options })
        },
        remove(name: string, options: CookieOptions) {
          response.cookies.set({ name, value: '', ...options })
        },
      },
    }
  )

  const { data: { session } } = await supabase.auth.getSession()
  const { pathname } = request.nextUrl

  // Public routes that don't require authentication
  const publicRoutes = ['/', '/login', '/signup', '/request-invite', '/forgot-password']
  const isPublicRoute = publicRoutes.some(route => pathname === route || pathname.startsWith(route))

  // If no session and trying to access protected route, redirect to LOGIN (not home)
  if (!session && !isPublicRoute) {
    const redirectUrl = new URL('/login', request.url)
    redirectUrl.searchParams.set('redirectTo', pathname)
    return NextResponse.redirect(redirectUrl)
  }

  // If has session and trying to access login/signup, redirect to feed
  if (session && (pathname === '/login' || pathname === '/signup')) {
    return NextResponse.redirect(new URL('/feed', request.url))
  }

  // If authenticated user tries to access home page, redirect to feed
  if (session && pathname === '/') {
    return NextResponse.redirect(new URL('/feed', request.url))
  }

  // CRITICAL: Protect admin routes with server-side check
  if (pathname.startsWith('/admin')) {
    if (!session) {
      return NextResponse.redirect(new URL('/login', request.url))
    }

    const { data: adminUser, error } = await supabase
      .from('admin_users')
      .select('user_id')
      .eq('user_id', session.user.id)
      .maybeSingle()

    if (!adminUser || error) {
      console.warn(`Unauthorized admin access attempt: ${session.user.id}`)
      return new NextResponse('Forbidden', { status: 403 })
    }
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}