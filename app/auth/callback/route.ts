import { NextRequest, NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const origin = requestUrl.origin;

  if (!code) {
    return NextResponse.redirect(`${origin}/?login=1&error=missing_code`);
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;

  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.redirect(`${origin}/?login=1&error=config_error`);
  }

  // Single redirect response: session cookies from exchangeCodeForSession must stay on THIS
  // response. Returning a new NextResponse.redirect() for /onboarding used to drop cookies,
  // so onboarding saw no session and sent users to ?error=session_expired.
  const response = NextResponse.redirect(`${origin}/dashboard`);

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

  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error("Auth callback error:", error.message);
    return NextResponse.redirect(
      `${origin}/?login=1&error=${encodeURIComponent(error.message)}`
    );
  }

  if (backendUrl && data?.session?.access_token) {
    try {
      const orgsResp = await fetch(`${backendUrl}/orgs`, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${data.session.access_token}`,
        },
        cache: "no-store",
      });
      if (orgsResp.ok) {
        const orgsData = await orgsResp.json();
        if (!orgsData.organizations || orgsData.organizations.length === 0) {
          response.headers.set("Location", `${origin}/onboarding`);
        }
      }
    } catch {
      // Non-fatal: keep default Location (/dashboard)
    }
  }

  return response;
}
