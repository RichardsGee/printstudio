import { redirect } from 'next/navigation';

/**
 * `/admin` redireciona pra `/admin/waitlist` (Story 9.2 AC #5).
 *
 * Waitlist é a tela default — primeira coisa que Richard precisa ver
 * pra qualificar leads e gerar invites (Stories 9.3 + 9.4).
 *
 * Layout pai já validou super_admin via `requireSuperAdmin()`.
 */
export default function AdminIndexPage() {
  redirect('/admin/waitlist');
}
