'use client';

import { useState } from 'react';
import { Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { AdminSidebar } from './admin-sidebar';

/**
 * Versão mobile da sidebar — Radix Dialog drawer (Story 9.2 AC #6).
 *
 * Padrão Story 5.1 (mobile responsive): botão hamburger no header
 * abre Dialog que contém o `AdminSidebar` em fullwidth. Clicar num
 * link fecha o drawer automaticamente via `onNavigate`.
 *
 * Visível apenas em < lg (lg:hidden via wrapper no layout).
 */
export function AdminSidebarMobile() {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Abrir menu admin"
        >
          <Menu className="size-5" aria-hidden="true" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogTitle className="text-body uppercase tracking-wider">
          Admin · Navegação
        </DialogTitle>
        <AdminSidebar onNavigate={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}
