import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "./lib/supabase/middleware";

// 需要登录才能访问的路径
const PROTECTED_PREFIXES = ["/products", "/import", "/settings"];
// 已登录用户访问时跳转到产品列表
const AUTH_PAGES = ["/login", "/register"];

export async function middleware(request: NextRequest) {
  const { supabaseResponse, user } = await updateSession(request);
  const { pathname } = request.nextUrl;

  const isProtected =
    pathname === "/" ||
    PROTECTED_PREFIXES.some(
      (p) => pathname === p || pathname.startsWith(p + "/")
    );

  if (!user && isProtected) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (user && AUTH_PAGES.includes(pathname)) {
    return NextResponse.redirect(new URL("/products", request.url));
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
