import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // Allow iframe embedding for share/dashboard routes
  if (request.nextUrl.pathname.startsWith('/share/dashboard/')) {
    const response = NextResponse.next();

    // Remove ALL headers that could block iframe embedding
    response.headers.delete('X-Frame-Options');
    response.headers.delete('Content-Security-Policy');
    response.headers.delete('content-security-policy');
    response.headers.delete('x-frame-options');

    // Don't set X-Frame-Options at all to allow iframe embedding
    response.headers.set('Access-Control-Allow-Origin', '*');
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: '/share/dashboard/:path*',
};
