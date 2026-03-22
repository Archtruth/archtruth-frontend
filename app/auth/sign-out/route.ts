import { NextRequest, NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { PREFERRED_ORG_COOKIE } from "@/lib/org-preference-constants";

/**
 * Clears Supabase auth cookies reliably. Server actions use getSupabaseServerClient()
 * with no-op cookie writes, so signOut() there does not remove browser cookies.
 * Use this route after logout / delete account / broken session.
 */
export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const origin = requestUrl.origin;
  const next = requestUrl.searchParams.get("next") || "/?login=1";

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.redirect(`${origin}/`);
  }

  let response = NextResponse.redirect(new URL(next, origin));

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) {
        return request.cookies.get(name)?.value;
      },
      set(name: string, value: string, options: CookieOptions) {
        response.cookies.set({ name, value, ...options });
      },
      remove(name: string, options: CookieOptions) {
        response.cookies.set({ name, value: "", ...options, maxAge: 0 });
      },
    },
  });

  await supabase.auth.signOut();

  response.cookies.set({
    name: PREFERRED_ORG_COOKIE,
    value: "",
    path: "/",
    maxAge: 0,
  });

  return response;
}
