import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { AppHeader } from '@/components/app-header';

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect('/login');

  return (
    <div className="min-h-dvh flex flex-col">
      <AppHeader userEmail={session.user.email} />
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
