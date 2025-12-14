import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Supabase env vars are not set");
}

const cookieAdapter = {
  get(name: string) {
    return cookies().get(name)?.value;
  },
  set(name: string, value: string, options: CookieOptions) {
    cookies().set({ name, value, ...options });
  },
  remove(name: string, options: CookieOptions) {
    cookies().set({ name, value: "", ...options, maxAge: 0 });
  },
};

export function getSupabaseServerClient() {
  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: cookieAdapter,
  });
}

export async function getServerSession() {
  const supabase = getSupabaseServerClient();
  const { data } = await supabase.auth.getSession();
  return data.session;
}

