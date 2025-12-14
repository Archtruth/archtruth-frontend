import { redirect } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  const supabase = getSupabaseServerClient();
  const { data } = await supabase.auth.getSession();
  if (data.session) {
    redirect("/dashboard");
  }

  return <LoginForm />;
}
