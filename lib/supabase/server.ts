import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Supabase env vars are not set");
}

export function getSupabaseServerClient() {
  const cookieStore = cookies();
  
  return createServerClient(supabaseUrl!, supabaseAnonKey!, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
      set() {
        // NO-OP: Cookie writes handled by middleware
        // This prevents the "Cookies can only be modified" error
      },
      remove() {
        // NO-OP: Cookie writes handled by middleware
      },
    },
  });
}

export async function getServerSession() {
  const supabase = getSupabaseServerClient();
  const { data } = await supabase.auth.getSession();
  return data.session;
}

