import Link from "next/link";

export default function Dashboard() {
  return (
    <>
      <h1>Dashboard</h1>
      <p>Connect your GitHub App installation to start scanning repositories.</p>
      <ul>
        <li>
          <Link href="/dashboard/connect-github">Connect GitHub</Link>
        </li>
        <li>
          <Link href="/dashboard/repos">Repositories</Link>
        </li>
      </ul>
    </>
  );
}

