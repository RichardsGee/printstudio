import { Activity, Thermometer, Flame, Scale, Zap, CheckCircle2, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { Metric } from '@/components/ui/metric';
import { ProgressBar } from '@/components/ui/progress-bar';
import { SectionLabel } from '@/components/ui/section-label';

/**
 * Catálogo vivo do design system — todos os atoms & molecules com
 * exemplos de uso lado a lado. Serve como documentação visual e como
 * linter humano pra garantir consistência ao longo do projeto.
 */
export default function DesignSystemPage() {
  return (
    <div className="space-y-6 max-w-5xl">
      <header className="space-y-1">
        <h1 className="text-heading">PrintStudio Design System</h1>
        <p className="text-small text-muted-foreground">
          Atoms + molecules + tokens que compõem a plataforma. Tudo vivo — os exemplos abaixo
          são instâncias reais dos componentes, não imagens.
        </p>
      </header>

      {/* TYPOGRAPHY */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-body">Tipografia</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Row label="text-display">
            <span className="text-display">1,234g</span>
          </Row>
          <Row label="text-heading">
            <span className="text-heading">A1 Principal</span>
          </Row>
          <Row label="text-body-lg">
            <span className="text-body-lg">Corpo grande</span>
          </Row>
          <Row label="text-body">
            <span className="text-body">Corpo padrão — texto longo de referência</span>
          </Row>
          <Row label="text-small">
            <span className="text-small">Texto pequeno secundário</span>
          </Row>
          <Row label="text-caption">
            <span className="text-caption text-muted-foreground">Caption (metadata)</span>
          </Row>
          <Row label="text-micro">
            <span className="text-micro font-mono uppercase tracking-wider text-muted-foreground">
              MICRO UPPERCASE MONO
            </span>
          </Row>
        </CardContent>
      </Card>

      {/* COLORS */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-body">Cores semânticas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {(['primary', 'success', 'warning', 'danger', 'info'] as const).map((t) => (
              <div key={t} className="space-y-1.5">
                <div
                  className="h-12 rounded-md border border-border/60"
                  style={{ background: `hsl(var(--${t}))` }}
                />
                <div className="text-small font-mono">--{t}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* CHIPS */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-body">
            <code className="text-small">{'<Chip>'}</code> — badges monospace
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Chip>DEFAULT</Chip>
            <Chip tone="muted">MUTED</Chip>
            <Chip tone="primary">PRIMARY</Chip>
            <Chip tone="success" icon={CheckCircle2}>SUCESSO</Chip>
            <Chip tone="warning" icon={AlertTriangle}>ATENÇÃO</Chip>
            <Chip tone="danger" icon={AlertTriangle}>CRÍTICO</Chip>
            <Chip tone="info">INFO</Chip>
          </div>
          <div className="flex flex-wrap gap-2">
            <Chip size="md" tone="primary">MD SIZE</Chip>
            <Chip size="md" tone="warning" icon={AlertTriangle}>MÉDIO COM ÍCONE</Chip>
          </div>
        </CardContent>
      </Card>

      {/* METRIC */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-body">
            <code className="text-small">{'<Metric>'}</code> — label + valor padrão
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <SectionLabel className="mb-2">layout="stack" (default)</SectionLabel>
            <div className="grid grid-cols-4 gap-3">
              <Metric label="Bico" value="215.3°C" tone="warning" />
              <Metric label="Mesa" value="62.0°C" tone="warning" />
              <Metric label="Progresso" value="87%" tone="primary" />
              <Metric label="Tempo" value="2h 15m" sub="restante" />
            </div>
          </div>

          <div>
            <SectionLabel className="mb-2">layout="card"</SectionLabel>
            <div className="grid grid-cols-4 gap-3">
              <Metric label="Termina" value="04:32" layout="card" />
              <Metric label="Restante" value="0m" layout="card" />
              <Metric label="Velocidade" value="100%" layout="card" tone="success" />
              <Metric label="Filamento" value="2.31g" layout="card" sub="de 4.90g" />
            </div>
          </div>

          <div>
            <SectionLabel className="mb-2">layout="row"</SectionLabel>
            <div className="space-y-1 max-w-xs">
              <Metric label="Bico" value="215°C / 220°" icon={Thermometer} tone="warning" layout="row" />
              <Metric label="Mesa" value="62°C / 60°" icon={Flame} tone="warning" layout="row" />
              <Metric label="Consumo" value="127W" icon={Zap} tone="info" layout="row" />
              <Metric label="Filamento" value="2.31g" icon={Scale} layout="row" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* PROGRESS */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-body">
            <code className="text-small">{'<ProgressBar>'}</code> — barras padronizadas
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <ProgressBar label="Progresso" primary="87.3%" value={87.3} accent="primary" />
          <ProgressBar label="Camadas" primary="245/281" value={245} max={281} accent="success" />
          <ProgressBar label="Filamento restante" primary="32%" value={32} accent="warning" size="md" />
          <ProgressBar label="Tamanhos" primary="value" value={50} size="xs" />
          <ProgressBar value={50} size="sm" accent="info" />
          <ProgressBar value={50} size="md" accent="danger" />
          <ProgressBar value={75} size="lg" accent="primary" />
        </CardContent>
      </Card>

      {/* BUTTONS */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-body">
            <code className="text-small">{'<Button>'}</code> — shadcn base
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button>Default</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="destructive">Destructive</Button>
          <Button size="sm">Small</Button>
          <Button size="sm" variant="outline">
            <Activity className="h-4 w-4 mr-1.5" /> Ícone
          </Button>
        </CardContent>
      </Card>

      {/* SPACING */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-body">Spacing + elevation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="h-16 w-16 rounded-md bg-muted/40" />
            <div className="h-16 w-16 rounded-md bg-muted/40 shadow-elev-1" />
            <div className="h-16 w-16 rounded-md bg-muted/40 shadow-elev-2" />
            <div className="h-16 w-16 rounded-md bg-muted/40 shadow-elev-3" />
          </div>
          <div className="text-caption text-muted-foreground font-mono">
            flat · elev-1 · elev-2 · elev-3
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[10rem_1fr] gap-4 items-center py-1.5 border-b border-border/30 last:border-0">
      <code className="text-caption font-mono text-muted-foreground">{label}</code>
      <div>{children}</div>
    </div>
  );
}
