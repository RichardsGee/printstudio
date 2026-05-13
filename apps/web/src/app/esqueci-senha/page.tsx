import type { Metadata } from 'next';
import Link from 'next/link';
import { Mail, MessageCircle, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

export const metadata: Metadata = {
  title: 'Recuperar senha · PrintStudio',
  description:
    'Recuperação de senha do PrintStudio. Suporte manual em até 24h.',
  robots: { index: false, follow: false },
};

/**
 * Página `/esqueci-senha` — Story 8.8.
 *
 * Decisão fechada PRD 8: SEM password reset automático V1 (alinhado
 * com a ausência de email transactional V1). Esta página comunica
 * o procedimento manual: user contata suporte e Richard reset à mão
 * em até 24h.
 *
 * V2 (quando Resend / SES entrar): substituir por form com magic link.
 */
export default function EsqueciSenhaPage() {
  return (
    <div className="min-h-dvh grid place-items-center p-4">
      <Card data-mc-card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <div
            data-mc-id
            className="text-caption uppercase tracking-widest text-primary"
          >
            {'// PASSWORD-RESET · MANUAL'}
          </div>
          <CardTitle className="text-heading uppercase tracking-wider">
            Recuperar senha
          </CardTitle>
          <CardDescription className="text-small">
            Por enquanto fazemos isso manualmente — em breve será automático.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3 rounded-md border border-[var(--mc-accent-soft)]/30 bg-card/40 p-4">
            <p className="text-small">
              Entre em contato com nosso suporte que recuperamos sua senha
              em até 24h.
            </p>

            <ul className="space-y-2">
              <li className="flex items-center gap-3">
                <Mail
                  className="size-4 shrink-0 text-primary"
                  aria-hidden="true"
                />
                <div className="space-y-0.5">
                  <p
                    data-mc-label
                    className="text-caption uppercase tracking-wider text-muted-foreground"
                  >
                    Email
                  </p>
                  <a
                    href="mailto:suporte@guiaprint3d.com"
                    className="font-mono text-small text-primary underline-offset-2 hover:underline"
                  >
                    suporte@guiaprint3d.com
                  </a>
                </div>
              </li>

              <li className="flex items-center gap-3">
                <MessageCircle
                  className="size-4 shrink-0 text-primary"
                  aria-hidden="true"
                />
                <div className="space-y-0.5">
                  <p
                    data-mc-label
                    className="text-caption uppercase tracking-wider text-muted-foreground"
                  >
                    WhatsApp
                  </p>
                  <span className="font-mono text-small text-muted-foreground">
                    (a definir antes do launch)
                  </span>
                </div>
              </li>
            </ul>

            <div className="flex items-center gap-2 pt-1 text-caption text-muted-foreground">
              <Clock className="size-3" aria-hidden="true" />
              <span>Resposta em até 24h em dias úteis</span>
            </div>
          </div>

          <p
            data-mc-id
            className="text-caption font-mono uppercase tracking-wider text-muted-foreground"
          >
            {'// INFO · Inclua o email cadastrado na mensagem'}
          </p>

          <Button asChild variant="outline" className="w-full">
            <Link href="/login">Voltar pro login</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
