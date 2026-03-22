import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/supabase/server";
import { backendFetch, isUnauthorizedBackendError } from "@/lib/api/backend";
import { OnboardingClient } from "./onboarding-client";

export default async function OnboardingPage() {
  const session = await getServerSession();
  if (!session?.access_token) {
    redirect("/?login=1&error=session_expired");
  }

  const token = session.access_token;
  const providerToken = (session as any)?.provider_token as string | undefined;

  // If user already has orgs, skip to dashboard
  try {
    const orgsResp = await backendFetch<{ organizations: { id: string; name: string }[] }>("/orgs", token);
    if (orgsResp.organizations && orgsResp.organizations.length > 0) {
      redirect("/dashboard");
    }
  } catch (e) {
    if (isUnauthorizedBackendError(e)) redirect("/?login=1&error=session_expired");
  }

  // Fetch GitHub orgs
  let githubOrgs: any[] = [];
  if (providerToken) {
    try {
      const ghResp = await backendFetch<{ github_orgs: any[] }>("/github/orgs", token, {
        headers: { "X-GitHub-Token": providerToken },
      });
      githubOrgs = ghResp.github_orgs || [];
    } catch {
      // Non-fatal
    }
  }

  return (
    <OnboardingClient
      githubOrgs={githubOrgs}
      token={token}
      providerToken={providerToken}
    />
  );
}
