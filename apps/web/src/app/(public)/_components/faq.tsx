import type { ReactNode } from 'react';
import Link from 'next/link';
import { ChevronDown } from 'lucide-react';

/**
 * FAQ — Story 7.7 AC 10-12.
 *
 * `<details>`/`<summary>` nativo: acessível por default e zero JS
 * (Server Component, sem 'use client'). Cada item tem `id` ancorável
 * pra deep-link (ex: `/#faq-pricing`) — `scroll-mt-24` compensa o
 * header sticky no scroll da âncora.
 */
interface FaqItem {
  id: string;
  q: string;
  a: ReactNode;
}

const FAQS: FaqItem[] = [
  {
    id: 'faq-bambu-models',
    q: 'Pra qual impressora funciona?',
    a: (
      <>
        No V1, foco total na <strong>Bambu Lab A1</strong> — é onde
        garantimos telemetria confiável. P1S e X1 estão no roadmap (a
        arquitetura cloud já suporta, falta validação de campo).
      </>
    ),
  },
  {
    id: 'faq-bridge',
    q: 'Preciso instalar bridge na rede local?',
    a: (
      <>
        Não. O GuiaPrint3D é <strong>cloud-nativo</strong>: conecta direto
        na Bambu Cloud com seu próprio token. Sem rodar serviço na LAN, sem
        expor IPs, sem porta aberta no roteador.
      </>
    ),
  },
  {
    id: 'faq-pricing',
    q: 'Quanto vai custar?',
    a: (
      <>
        Tem <strong>plano gratuito</strong> pra 1 impressora. Planos pagos
        a partir de <strong>R$49/mês</strong> pra quem opera frota maior. Os
        números finais e limites de cada plano saem quando o acesso abrir —{' '}
        <Link
          href="/#waitlist"
          className="text-primary underline-offset-2 hover:underline"
        >
          entre na lista
        </Link>{' '}
        pra ser avisado.
      </>
    ),
  },
  {
    id: 'faq-launch',
    q: 'Quando libera?',
    a: (
      <>
        O acesso é <strong>por convite</strong>, em ordem de fila combinada
        com qualificação (priorizamos quem opera mais impressoras e tem dor
        real de monitorar à distância). Cadastrar na waitlist garante sua
        posição.
      </>
    ),
  },
  {
    id: 'faq-data',
    q: 'Meus dados ficam onde?',
    a: (
      <>
        Infraestrutura no <strong>Brasil</strong> (AWS sa-east-1),
        compatível com a <strong>LGPD</strong>. Você pode pedir exportação
        ou exclusão a qualquer momento — detalhes na{' '}
        <Link
          href="/politica-de-privacidade"
          className="text-primary underline-offset-2 hover:underline"
        >
          política de privacidade
        </Link>
        .
      </>
    ),
  },
  {
    id: 'faq-cancel',
    q: 'Posso cancelar quando quiser?',
    a: (
      <>
        Sim. Sem fidelidade nem multa. Você cancela pelo painel a qualquer
        momento, e ainda tem <strong>7 dias de arrependimento</strong> com
        reembolso integral (CDC art. 49) no primeiro pagamento.
      </>
    ),
  },
  {
    id: 'faq-opensource',
    q: 'É open source?',
    a: (
      <>
        No V1, não. Partes do projeto (ex: protocolo de comunicação Bambu)
        podem ser abertas numa V1.1 — ainda em avaliação.
      </>
    ),
  },
  {
    id: 'faq-mobile',
    q: 'Tem app mobile?',
    a: (
      <>
        O V1 é <strong>PWA</strong>: instala na tela inicial do celular e
        funciona como app, inclusive em modo kiosk numa tela de oficina.
        App nativo (iOS/Android) é V2.
      </>
    ),
  },
];

export function Faq() {
  return (
    <section
      id="faq"
      className="container max-w-3xl py-16 sm:py-20"
      aria-labelledby="faq-title"
    >
      <div className="mb-10 space-y-3">
        <p
          data-mc-id
          className="text-caption font-mono uppercase tracking-wider text-primary"
        >
          {'// SYSTEM · FAQ'}
        </p>
        <h2 id="faq-title" className="text-3xl font-semibold sm:text-4xl">
          Perguntas frequentes
        </h2>
        <p className="text-body text-muted-foreground">
          As dúvidas que mais aparecem antes de entrar na lista.
        </p>
      </div>

      <div className="space-y-3">
        {FAQS.map(({ id, q, a }) => (
          <details
            key={id}
            id={id}
            className="group scroll-mt-24 rounded-lg border border-[var(--mc-accent-soft)]/30 bg-card/40 p-5"
            data-mc-card
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-body font-medium [&::-webkit-details-marker]:hidden">
              <span>{q}</span>
              <ChevronDown
                className="size-4 shrink-0 text-primary transition-transform duration-200 group-open:rotate-180"
                aria-hidden="true"
              />
            </summary>
            <div className="mt-3 text-small leading-relaxed text-muted-foreground">
              {a}
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}
