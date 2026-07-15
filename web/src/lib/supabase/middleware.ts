import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

const AUTH_ROUTES = ['/login', '/forgot-password', '/reset-password', '/auth/callback'];

function isAuthRoute(pathname: string): boolean {
  return AUTH_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
}

function getSupabasePublicEnv() {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';
  return { url: url.trim(), anonKey: anonKey.trim() };
}

/**
 * Toda la app (módulos, home, legacy) exige sesión.
 * Solo login / forgot / reset / callback son públicos.
 */
export async function updateSession(request: NextRequest) {
  const { url, anonKey } = getSupabasePublicEnv();
  const { pathname } = request.nextUrl;

  if (isAuthRoute(pathname)) {
    // Rutas públicas de auth: si ya hay sesión, mandar al launcher
    if (!url || !anonKey) {
      return NextResponse.next({ request });
    }

    let supabaseResponse = NextResponse.next({ request });
    try {
      const supabase = createServerClient(url, anonKey, {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) => {
              request.cookies.set(name, value);
            });
            supabaseResponse = NextResponse.next({ request });
            cookiesToSet.forEach(({ name, value, options }) => {
              supabaseResponse.cookies.set(name, value, options);
            });
          },
        },
      });

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user && pathname !== '/reset-password') {
        const homeUrl = request.nextUrl.clone();
        homeUrl.pathname = '/';
        homeUrl.search = '';
        return NextResponse.redirect(homeUrl);
      }
    } catch (err) {
      console.error('[middleware] auth route session error:', err);
    }
    return supabaseResponse;
  }

  // Rutas protegidas (todo lo demás)
  if (!url || !anonKey) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    loginUrl.searchParams.set('next', pathname);
    loginUrl.searchParams.set('error', 'auth_not_configured');
    return NextResponse.redirect(loginUrl);
  }

  let supabaseResponse = NextResponse.next({ request });

  try {
    const supabase = createServerClient(url, anonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => {
            supabaseResponse.cookies.set(name, value, options);
          });
        },
      },
    });

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = '/login';
      loginUrl.searchParams.set('next', pathname === '/' ? '/' : pathname);
      return NextResponse.redirect(loginUrl);
    }
  } catch (err) {
    console.error('[middleware] supabase session error:', err);
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    loginUrl.searchParams.set('next', pathname);
    loginUrl.searchParams.set('error', 'auth_session');
    return NextResponse.redirect(loginUrl);
  }

  return supabaseResponse;
}
