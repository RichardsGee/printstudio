import { Activity, GripVertical, CloudCog, History } from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

const FEATURES = [
  {
    icon: Activity,
    title: 'Mission Control visual',
    description:
      'Dashboard estilo HUD com telemetria em tempo real: nozzle, bed, fan, progresso e ETA — tudo num glance.',
    code: 'TELEMETRY',
  },
  {
    icon: GripVertical,
    title: 'Multi-impressora com drag',
    description:
      'Reordene as Bambu por prioridade arrastando os cards. Sincroniza entre devices automaticamente.',
    code: 'REORDER',
  },
  {
    icon: CloudCog,
    title: 'Cloud nativo, sem bridge',
    description:
      'Conecta direto na Bambu Cloud com seu próprio token. Sem rodar bridge na rede local, sem expor IPs.',
    code: 'NO-LAN',
  },
  {
    icon: History,
    title: 'Histórico e alertas',
    description:
      'Cada print fica registrado com timeline, screenshots e tempo total. Alertas de falha por WhatsApp/Telegram.',
    code: 'HISTORY',
  },
] as const;

/**
 * Grid de 4 mission cards apresentando os pilares do produto.
 * Mobile: 1 coluna · Tablet: 2 · Desktop: 4.
 */
export function Features() {
  return (
    <section
      id="features"
      className="container max-w-6xl py-16 sm:py-20"
      aria-labelledby="features-title"
    >
      <div className="mb-10 space-y-3">
        <p
          data-mc-id
          className="text-caption font-mono uppercase tracking-wider text-primary"
        >
          {'// SYSTEM · CAPABILITIES'}
        </p>
        <h2
          id="features-title"
          className="text-3xl font-semibold sm:text-4xl"
        >
          Tudo que falta na app oficial da Bambu
        </h2>
        <p className="text-body text-muted-foreground max-w-2xl">
          Construído por quem opera frota de A1 todo dia. Foco em
          confiabilidade, visibilidade e operação remota.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {FEATURES.map(({ icon: Icon, title, description, code }) => (
          <Card key={code} data-mc-card className="h-full">
            <CardHeader className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="inline-flex size-9 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <Icon className="size-5" aria-hidden="true" />
                </div>
                <span
                  data-mc-id
                  className="text-caption font-mono uppercase tracking-wider text-muted-foreground"
                >
                  {`// ${code}`}
                </span>
              </div>
              <CardTitle className="text-body-lg">{title}</CardTitle>
            </CardHeader>
            <CardContent className="text-small text-muted-foreground">
              {description}
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
