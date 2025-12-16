import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/supabase/server";

type LoginPageProps = {
  searchParams?: Record<string, string | string[] | undefined>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const session = await getServerSession();
  if (session?.user) {
    redirect("/dashboard");
  }

  const error = searchParams?.error;
  const next = searchParams?.next;

  const errorValue = Array.isArray(error) ? error[0] : error;
  const nextValue = Array.isArray(next) ? next[0] : next;

  const qs = new URLSearchParams();
  qs.set("login", "1");
  if (errorValue) qs.set("error", errorValue);
  if (nextValue) qs.set("next", nextValue);

  redirect(`/?${qs.toString()}`);
}
