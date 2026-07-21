import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    const demoMode = process.env.NODE_ENV !== "production";
    const authPath = ["/login", "/register", "/forgot-password"].includes(request.nextUrl.pathname);
    if (demoMode && authPath) return NextResponse.redirect(new URL("/app", request.url));
    const needsAuth = request.nextUrl.pathname.startsWith("/app") || request.nextUrl.pathname.startsWith("/onboarding");
    return needsAuth && !demoMode ? NextResponse.redirect(new URL("/login", request.url)) : response;
  }
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (items) => {
        items.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        items.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  const { data: { user } } = await supabase.auth.getUser();
  const protectedPath = request.nextUrl.pathname.startsWith("/app") || request.nextUrl.pathname.startsWith("/onboarding");
  const authPath = ["/login", "/register"].includes(request.nextUrl.pathname);
  if (protectedPath && !user) return NextResponse.redirect(new URL("/login", request.url));
  if (authPath && user) return NextResponse.redirect(new URL("/app", request.url));
  return response;
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico|icons/|sw.js).*)"] };
