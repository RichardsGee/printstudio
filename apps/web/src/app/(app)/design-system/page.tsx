'use client';

import { Activity, Thermometer, Flame, Scale, Zap, CheckCircle2, AlertTriangle, Image as ImageIcon, PencilRuler } from 'lucide-react';
import type { PrinterState } from '@printstudio/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { Metric } from '@/components/ui/metric';
import { ProgressBar } from '@/components/ui/progress-bar';
import { SectionLabel } from '@/components/ui/section-label';
import { MissionGauge } from '@/components/kiosk/mission-gauge';
import { SensorPanel } from '@/components/kiosk/sensor-panel';
import { cn } from '@/lib/utils';
import '../../(kiosk)/kiosk-theme.css';

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

      {/* MISSION CONTROL — tema do kiosk */}
      <header className="space-y-1 pt-6 border-t border-border/40">
        <h2 className="text-heading">Mission Control · tema do Kiosk</h2>
        <p className="text-small text-muted-foreground">
          Tema sci-fi/comando aplicado em <code className="text-caption font-mono">/kiosk</code>.
          Visual de NASA Mission Control / Matrix com grid background, scanlines CRT, monospace,
          paleta cyan e elementos com brackets nos cantos.
        </p>
      </header>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-body">Paleta de cores · Mission Mode</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <McColor name="--mc-accent" hex="#22d3ee" desc="Primário · cyan vivo" />
            <McColor name="--mc-accent-soft" hex="#0891b2" desc="Cyan escuro · borders/labels" />
            <McColor name="--mc-warning" hex="#fbbf24" desc="Amber · sensores em alerta" />
            <McColor name="--mc-danger" hex="#ef4444" desc="Erros HMS · valores críticos" />
            <McColor name="--mc-success" hex="#34d399" desc="Conclusão · OK" />
            <McColor name="--mc-bg" hex="#050810" desc="Background base do tema" />
            <McColor name="--mc-fg" hex="#d1d5db" desc="Foreground neutro" />
            <McColor name="--mc-fg-dim" hex="#6b7280" desc="Texto secundário" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-body">Status labels · estilo telemetria</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-small text-muted-foreground">
            Substituem nomes humanizados (<code className="text-caption font-mono">Imprimindo, Pausada</code>) por
            tags técnicas entre brackets — convenção de painel de comando.
          </p>
          <div className="flex flex-wrap gap-2 font-mono text-caption">
            <McStatus tone="ok">[ACTIVE]</McStatus>
            <McStatus tone="ok">[OK]</McStatus>
            <McStatus tone="warn">[BOOT]</McStatus>
            <McStatus tone="warn">[HOLD]</McStatus>
            <McStatus tone="dim">[STBY]</McStatus>
            <McStatus tone="dim">[NO-LINK]</McStatus>
            <McStatus tone="crit">[ERR]</McStatus>
            <McStatus tone="dim">[?]</McStatus>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-body">
            <code className="text-small">{'<MissionGauge>'}</code> — barra HUD segmentada
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="kiosk-mission demo-mode space-y-3 p-4 bg-[var(--mc-bg)]/50 rounded-md">
            <div>
              <SectionLabel className="mb-1 text-[var(--mc-accent)]">PROGRESS · 25%</SectionLabel>
              <MissionGauge value={25} />
            </div>
            <div>
              <SectionLabel className="mb-1 text-[var(--mc-accent)]">PROGRESS · 67%</SectionLabel>
              <MissionGauge value={67} />
            </div>
            <div>
              <SectionLabel className="mb-1 text-[var(--mc-accent)]">PROGRESS · 100% (10 segmentos)</SectionLabel>
              <MissionGauge value={100} segments={10} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-body">
            <code className="text-small">{'<SensorPanel>'}</code> — telemetria por níveis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-small text-muted-foreground mb-3">
            Cada linha tem nível por cor: <span className="text-[var(--mc-accent)] font-mono">ok (cyan)</span> ·{' '}
            <span className="text-[var(--mc-warning)] font-mono">warn (amber)</span> ·{' '}
            <span className="text-[var(--mc-danger)] font-mono">crit (red)</span> ·{' '}
            <span className="text-muted-foreground font-mono">off (dim)</span>
          </p>
          <div className="kiosk-mission demo-mode grid grid-cols-1 md:grid-cols-2 gap-3 p-4 bg-[var(--mc-bg)]/50 rounded-md">
            <div className="rounded-md border border-[var(--mc-accent-soft)]/40 p-3 bg-black/20">
              <div className="text-[10px] uppercase text-muted-foreground mb-1.5">imprimindo (níveis ok)</div>
              <SensorPanel state={MOCK_PRINTING} />
            </div>
            <div className="rounded-md border border-[var(--mc-accent-soft)]/40 p-3 bg-black/20">
              <div className="text-[10px] uppercase text-muted-foreground mb-1.5">aquecendo (níveis warn)</div>
              <SensorPanel state={MOCK_HEATING} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-body">Card · brackets nos cantos</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-small text-muted-foreground mb-3">
            Estrutura de card no Mission Mode: cantos retos + brackets cyan via{' '}
            <code className="text-caption font-mono">[data-mc-card]::before / ::after</code>.
            Header tem <code className="text-caption font-mono">[data-mc-led]</code> pulsando.
          </p>
          <div className="kiosk-mission demo-mode p-4 bg-[var(--mc-bg)]/50 rounded-md">
            <div data-mc-card className="border-2 p-0 max-w-md">
              <div className="px-3 py-2 flex items-center gap-2 border-b border-[var(--mc-accent-soft)]/30 bg-[var(--mc-accent)]/8">
                <span data-mc-led className="text-[var(--mc-accent)]" aria-hidden />
                <span data-mc-label className="text-xs font-semibold uppercase text-[var(--mc-accent)]">
                  [ACTIVE]
                </span>
                <span data-mc-id className="text-[10px] text-muted-foreground">// STN-3F0C</span>
                <span className="ml-auto text-xs font-semibold">A1 PRINCIPAL</span>
              </div>
              <div className="p-4 space-y-2">
                <SectionLabel className="text-[var(--mc-accent)]">CONTEÚDO</SectionLabel>
                <div className="text-small text-muted-foreground">
                  Aqui dentro vai o resto do conteúdo do card. Brackets aparecem nos 4 cantos.
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-body">Banner · Mission Control header</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="kiosk-mission demo-mode p-4 bg-[var(--mc-bg)]/50 rounded-md">
            <div
              data-mc-banner
              className="flex items-center justify-between gap-4 px-5 py-3 border-2 relative"
            >
              <div data-mc-id className="absolute -top-2 left-3 px-2 text-[10px] uppercase tracking-widest text-[var(--mc-accent)] bg-[var(--mc-bg)]">
                ◢ MISSION CONTROL · STATION TEL-RJ-01
              </div>
              <div className="flex items-center gap-3 min-w-0">
                <CheckCircle2 className="h-6 w-6" />
                <div>
                  <div className="font-semibold">Tudo tranquilo</div>
                  <div className="text-xs text-muted-foreground">2 impressoras · 2 ociosas</div>
                </div>
              </div>
              <div className="text-right shrink-0">
                <div data-mc-num className="text-2xl font-semibold">14:32:07</div>
                <div data-mc-id className="text-[10px] text-muted-foreground">
                  UTC-03:00 · LAT -22.9068 · LON -43.1729
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-body">Imagem da impressora · toggle REAL / TECH</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-small text-muted-foreground mb-3">
            Toggle entre foto real (<code className="text-caption font-mono">bambu-a1.png</code>) e blueprint
            técnico (<code className="text-caption font-mono">bambu-a1-blueprint.png</code>) com filtro CSS
            de cyan tint pra harmonizar com o tema.
          </p>
          <div className="kiosk-mission demo-mode grid grid-cols-2 gap-3 p-4 bg-[var(--mc-bg)]/50 rounded-md">
            <div className="aspect-square border border-[var(--mc-accent-soft)]/40 rounded-md overflow-hidden flex items-center justify-center bg-black/30 relative">
              <span className="absolute top-2 left-2 inline-flex items-center gap-1 rounded-md bg-background/80 backdrop-blur-sm border border-[var(--mc-accent-soft)] px-1.5 py-0.5">
                <ImageIcon className="h-3 w-3" />
                <span data-mc-label className="text-[10px] uppercase">REAL</span>
              </span>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/images/bambu-a1.png"
                alt="Bambu A1 real"
                className="max-h-full max-w-full object-contain p-3"
              />
            </div>
            <div className="aspect-square border border-[var(--mc-accent-soft)]/40 rounded-md overflow-hidden flex items-center justify-center bg-black/30 relative">
              <span className="absolute top-2 left-2 inline-flex items-center gap-1 rounded-md bg-background/80 backdrop-blur-sm border border-[var(--mc-accent-soft)] px-1.5 py-0.5">
                <PencilRuler className="h-3 w-3" />
                <span data-mc-label className="text-[10px] uppercase">TECH</span>
              </span>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/images/bambu-a1-blueprint.png"
                alt="Bambu A1 blueprint"
                className="max-h-full max-w-full object-contain p-3 kiosk-blueprint-tint"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-body">Animações · Mission Mode</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-small">
          <Row label="mc-boot">
            Fade-in 480ms ao montar a rota — opacidade + brightness flash.
          </Row>
          <Row label="mc-scanline-drift">
            Scanlines descem 24px a cada 6s simulando refresh CRT (mix-blend-mode: screen).
          </Row>
          <Row label="mc-led-pulse">
            LED dot 8×8 pulsando opacity 0.55→1 (2s ease-in-out infinite).
          </Row>
          <Row label="mc-glitch">
            Banner glitcha raramente (97-98% do ciclo de 14s) com translate + hue-rotate.
          </Row>
          <Row label="3D energy pulse">
            Sin wave 2.4s modula opacity de energy/halo/ring no preview 3D — sensação de respiração.
          </Row>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-body">Como aplicar</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-small">
          <p>
            1. Importar o tema:{' '}
            <code className="text-caption font-mono">{`import '@/app/(kiosk)/kiosk-theme.css';`}</code>
          </p>
          <p>
            2. Wrapper na rota:{' '}
            <code className="text-caption font-mono">{`<div className="kiosk-mission">`}</code>
          </p>
          <p>
            3. Em pages que NÃO sejam o kiosk (ex: este design system), usar o modificador{' '}
            <code className="text-caption font-mono">demo-mode</code> pra desativar pseudo-elementos
            globais (scanlines fixed):{' '}
            <code className="text-caption font-mono">{`<div className="kiosk-mission demo-mode">`}</code>
          </p>
          <p>
            4. Marcar elementos com data-attrs:{' '}
            <code className="text-caption font-mono">data-mc-card</code> ·{' '}
            <code className="text-caption font-mono">data-mc-banner</code> ·{' '}
            <code className="text-caption font-mono">data-mc-led</code> ·{' '}
            <code className="text-caption font-mono">data-mc-id</code> ·{' '}
            <code className="text-caption font-mono">data-mc-label</code> ·{' '}
            <code className="text-caption font-mono">data-mc-num</code> ·{' '}
            <code className="text-caption font-mono">data-mc-glitch</code>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function McColor({
  name,
  hex,
  desc,
}: {
  name: string;
  hex: string;
  desc: string;
}) {
  return (
    <div className="space-y-1.5">
      <div
        className="h-12 rounded-md border border-border/60"
        style={{ background: hex }}
      />
      <div className="text-small font-mono">{name}</div>
      <div className="text-caption text-muted-foreground">{desc}</div>
    </div>
  );
}

function McStatus({
  tone,
  children,
}: {
  tone: 'ok' | 'warn' | 'crit' | 'dim';
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        'inline-block px-2 py-0.5 border',
        tone === 'ok' && 'text-[var(--mc-accent)] border-[var(--mc-accent)]/50',
        tone === 'warn' && 'text-[var(--mc-warning)] border-[var(--mc-warning)]/50',
        tone === 'crit' && 'text-[var(--mc-danger)] border-[var(--mc-danger)]/50',
        tone === 'dim' && 'text-muted-foreground border-border/60',
      )}
    >
      {children}
    </span>
  );
}

const MOCK_PRINTING: PrinterState = {
  printerId: 'mock',
  status: 'PRINTING',
  progressPct: 45,
  currentLayer: 87,
  totalLayers: 193,
  remainingSec: 6420,
  currentFile: 'demo.3mf',
  hmsErrors: [],
  amsSlots: [],
  amsUnits: [],
  activeSlotIndex: 0,
  speedMode: null,
  speedPercent: 100,
  wifiSignalDbm: -54,
  fanPartCoolingPct: 70,
  fanAuxPct: 0,
  fanChamberPct: 0,
  fanHeatbreakPct: 0,
  nozzleTemp: 220,
  nozzleTargetTemp: 220,
  bedTemp: 60,
  bedTargetTemp: 60,
  chamberTemp: 28,
  nozzleDiameter: '0.4',
  nozzleType: 'stainless_steel',
  stage: 'Imprimindo',
  doorOpen: false,
  isFromSdCard: false,
  lifecycle: null,
  printType: 'cloud',
  printErrorCode: null,
  stateChangeReason: null,
  filamentWeightG: null,
  updatedAt: new Date().toISOString(),
};

const MOCK_HEATING: PrinterState = {
  ...MOCK_PRINTING,
  status: 'PREPARE',
  nozzleTemp: 145,
  nozzleTargetTemp: 220,
  bedTemp: 42,
  bedTargetTemp: 60,
  chamberTemp: 50,
  fanPartCoolingPct: 0,
  wifiSignalDbm: -78,
};

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[10rem_1fr] gap-4 items-center py-1.5 border-b border-border/30 last:border-0">
      <code className="text-caption font-mono text-muted-foreground">{label}</code>
      <div>{children}</div>
    </div>
  );
}
