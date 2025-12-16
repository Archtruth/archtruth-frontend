import { HomeClient } from "@/app/home/home-client";

type HomePageProps = {
  searchParams?: Record<string, string | string[] | undefined>;
};

export default function Home({ searchParams }: HomePageProps) {
  const login = searchParams?.login;
  const error = searchParams?.error;

  const loginValue = Array.isArray(login) ? login[0] : login;
  const errorValue = Array.isArray(error) ? error[0] : error;

  const initialLoginOpen = loginValue === "1" || loginValue === "true";

  return <HomeClient initialLoginOpen={initialLoginOpen} initialError={errorValue ?? null} />;
}
