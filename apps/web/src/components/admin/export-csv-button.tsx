'use client';

import { useSearchParams } from 'next/navigation';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ExportCsvButtonProps {
  /** Endpoint do route handler de export (ex: `/api/admin/export/waitlist`). */
  endpoint: string;
  /** Label do botão. Default "Exportar CSV". */
  label?: string;
}

/**
 * Botão de export que propaga os search params atuais pro endpoint
 * (Story 9.10). Click abre URL em nova aba — browser baixa direto
 * via `Content-Disposition: attachment`.
 *
 * Não usa fetch + blob pra evitar buffering em memória — Response do
 * route handler já tem o header certo.
 */
export function ExportCsvButton({ endpoint, label = 'Exportar CSV' }: ExportCsvButtonProps) {
  const searchParams = useSearchParams();
  const href = `${endpoint}?${searchParams.toString()}`;

  return (
    <Button asChild variant="outline" size="sm" className="gap-1.5">
      <a href={href} download>
        <Download className="size-3.5" aria-hidden="true" />
        {label}
      </a>
    </Button>
  );
}
