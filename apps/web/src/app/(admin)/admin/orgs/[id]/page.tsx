import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getOrgFullDetail } from '@/lib/admin-org-detail-queries';
import { OrgDetailClient } from './_components/org-detail-client';

export const metadata: Metadata = {
  title: 'Admin · Org · PrintStudio',
  robots: { index: false, follow: false },
};

/**
 * Detail drill-down de uma org (Story 9.6).
 *
 * Server Component carrega em paralelo:
 * - Dados da org
 * - Members (com role org + role user + is_super_admin)
 * - Printers (com displayOrder)
 * - 50 eventos mais recentes
 *
 * Layout pai garante super_admin (Story 9.1). UUID inválido ou org
 * inexistente → notFound().
 */
export default async function AdminOrgDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // Validação minimal de UUID antes de hit no DB
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const detail = await getOrgFullDetail(id);
  if (!detail) notFound();

  return <OrgDetailClient detail={detail} />;
}
