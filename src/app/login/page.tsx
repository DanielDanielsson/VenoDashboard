import { SignInButton } from '@ui/components/SignInButton/SignInButton';

interface LoginPageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

function readParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = searchParams ? await searchParams : {};
  const callbackUrl = readParam(params.callbackUrl) || '/dashboard';

  return (
    <main className="page-frame">
      <div className="shell-container section-stack">
        <SignInButton callbackUrl={callbackUrl} />
      </div>
    </main>
  );
}
