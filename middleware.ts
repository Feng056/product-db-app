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

  // 已登录但被停用（账号或分组）：强制登出
  if (user && isProtected) {
    try {
      const { createServerClient } = await import("@supabase/ssr");
      const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          cookies: {
            getAll() {
              return request.cookies.getAll();
            },
            setAll() {},
          },
        }
      );
      const { data: profile } = await supabase
        .from("profiles")
        .select("is_active, group_id, groups(is_active)")
        .eq("id", user.id)
        .single();
      const p = profile as {
        is_active?: boolean;
        group_id?: string | null;
        groups?: { is_active?: boolean } | null;
      } | null;
      if (p && (!p.is_active || (p.group_id && p.groups?.is_active === false))) {
        await supabase.auth.signOut();
        return NextResponse.redirect(new URL("/login?disabled=1", request.url));
      }
    } catch {
      // 查询失败时不阻断，放行
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
