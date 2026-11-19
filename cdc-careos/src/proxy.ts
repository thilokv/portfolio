import { NextResponse, type NextRequest } from "next/server";

/**
 * Optimistic route protection: requests without a session cookie are sent to
 * the sign-in page. Real authentication/authorization happens on the server
 * in the Data Access Layer (src/server/auth/actor.ts) for every request.
 */
const PUBLIC_PATHS = ["/login", "/forgot-password", "/reset-password"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  const hasSession = request.cookies.has("careos_session");
  if (!isPublic && !hasSession) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/health).*)"],
};
