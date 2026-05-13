'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  ClipboardList,
  Users,
  CreditCard,
  BarChart3,
  ScrollText,
  Settings as SettingsIcon,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Story que vai popular essa rota. Mostra badge "9.X" enquanto placeholder. */
  story: string;
}

const NAV_ITEMS: NavItem[] = [
  { href: '/admin/waitlist', label: 'Waitlist', icon: ClipboardList, story: '9.3' },
  { href: '/admin/orgs', label: 'Users · Orgs', icon: Users, story: '9.5' },
  { href: '/admin/subscriptions', label: 'Assinaturas', icon: CreditCard, story: '9.7' },
  { href: '/admin/metrics', label: 'Métricas', icon: BarChart3, story: '9.8' },
  { href: '/admin/audit', label: 'Audit Log', icon: ScrollText, story: '9.9' },
  { href: '/admin/config', label: 'Config', icon: SettingsIcon, story: 'V1.1' },
];

interface AdminSidebarProps {
  /** Optional className extra (ex: pra controlar visibility em drawer mobile). */
  className?: string;
  /** Callback chamado quando user clica num link (útil pra fechar drawer mobile). */
  onNavigate?: () => void;
}

/**
 * Sidebar de navegação do Admin Panel (Story 9.2).
 *
 * Visual Mission Control: items uppercase tracking-wider, border-left
 * cyan no active, ícone Lucide à esquerda. usePathname() detecta rota
 * atual (incluindo sub-rotas — `/admin/waitlist/123` ativa "Waitlist").
 *
 * Renderizada 2 vezes pelo `(admin)/layout.tsx`:
 * - Inline em desktop (>= lg, dentro do grid)
 * - Drawer em mobile (< lg, Dialog Radix)
 */
export function AdminSidebar({ className, onNavigate }: AdminSidebarProps) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Navegação admin"
      className={cn('flex flex-col gap-1', className)}
    >
      {NAV_ITEMS.map((item) => {
        const Icon = item.icon;
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex items-center justify-between gap-3 rounded-md border-l-2 px-3 py-2 text-small transition-colors',
              active
                ? 'border-primary bg-primary/10 text-foreground'
                : 'border-transparent text-muted-foreground hover:border-[var(--mc-accent-soft)]/40 hover:bg-card/40 hover:text-foreground',
            )}
          >
            <span className="flex items-center gap-3 uppercase tracking-wider">
              <Icon className="size-4 shrink-0" aria-hidden="true" />
              {item.label}
            </span>
            <span
              data-mc-id
              className="text-caption font-mono text-muted-foreground"
            >
              {item.story}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
