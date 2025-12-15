import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/supabase/server";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  const session = await getServerSession();
  if (session?.user) {
    redirect("/dashboard");
  }

  return <LoginForm />;
}
