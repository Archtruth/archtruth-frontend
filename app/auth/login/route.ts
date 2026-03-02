import { NextRequest, NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

/**
 * Server-side OAuth initiation route.
 *
 * Calling signInWithOAuth from a server route (instead of the browser client) means the
 * code_verifier is stored via reliable HTTP Set-Cookie response headers rather than the
 * browser client's setItemAsync(), which has a known intermittent bug in @supabase/ssr
 * where it silently fails to persist the cookie after auth storage has been cleared.
 *
 * See: https://github.com/supabase/ssr/issues/55
 */
export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const origin = requestUrl.origin;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.redirect(`${origin}/?login=1&error=config_error`);
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || origin;

  // Collect cookies set during signInWithOAuth (includes the code_verifier cookie)
  const cookiesToSet: Array<{
    name: string;
    value: string;
    options: CookieOptions;
  }> = [];

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) {
        return request.cookies.get(name)?.value;
      },
      set(name: string, value: string, options: CookieOptions) {
        cookiesToSet.push({ name, value, options });
      },
      remove(name: string, options: CookieOptions) {
        cookiesToSet.push({ name, value: "", options: { ...options, maxAge: 0 } });
      },
    },
  });

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "github",
    options: {
      redirectTo: `${siteUrl}/auth/callback`,
      scopes: "read:org",
      // skipBrowserRedirect so we get the URL back instead of an automatic redirect,
      // allowing us to attach Set-Cookie headers (code_verifier) before sending the browser to GitHub.
      skipBrowserRedirect: true,
    },
  });

  if (error || !data.url) {
    console.error("OAuth initiation error:", error?.message);
    return NextResponse.redirect(
      `${origin}/?login=1&error=${encodeURIComponent(error?.message ?? "oauth_error")}`
    );
  }

  // Redirect to GitHub OAuth URL with the code_verifier cookie set in the response headers.
  const response = NextResponse.redirect(data.url);

  cookiesToSet.forEach(({ name, value, options }) => {
    // Ensure code_verifier and auth cookies use SameSite=Lax so they are sent when
    // the user is redirected back from GitHub (cross-site top-level navigation).
    const cookieOptions =
      name.includes("code-verifier") || name.includes("auth-token")
        ? { ...options, sameSite: "lax" as const }
        : options;
    response.cookies.set({ name, value, ...cookieOptions });
  });

  return response;
}
