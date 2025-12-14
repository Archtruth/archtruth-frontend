const installUrl = process.env.NEXT_PUBLIC_GITHUB_APP_INSTALL_URL || "#";

export default function ConnectGithub() {
  return (
    <>
      <h1>Connect GitHub</h1>
      <p>
        Install the ArchTruth GitHub App, then complete the flow so we can link the installation to your
        organization.
      </p>
      <a href={installUrl} target="_blank" rel="noreferrer">
        Install GitHub App
      </a>
    </>
  );
}

