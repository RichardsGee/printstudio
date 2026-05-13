import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

/**
 * Placeholder de Story 7.1 (setup apps/marketing).
 * Landing page real é Story 7.2.
 *
 * Confirma que tema Mission Control renderiza corretamente em
 * marketing site standalone (independente do apps/web).
 */
export default function HomePage() {
  return (
    <div className="container max-w-5xl py-12 space-y-8">
      <PageHeader
        id="MARKETING"
        title="GuiaPrint3D"
        description="Setup do marketing site OK. Landing page chega na Story 7.2."
      />

      <Card data-mc-card>
        <CardHeader>
          <CardTitle className="text-body uppercase tracking-wider">
            Story 7.1 — Setup `apps/marketing`
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-small">
          <p>
            Este placeholder confirma que o tema Mission Control está
            renderizando corretamente neste app standalone.
          </p>
          <p data-mc-id className="text-caption text-primary">
            {'// STATUS · OK · '}
            <span data-mc-num>3002</span>
          </p>
          <ul className="text-caption text-muted-foreground space-y-1 pt-2">
            <li>✓ Next.js static export configurado</li>
            <li>✓ Tailwind + tokens Mission Control herdados</li>
            <li>✓ globals.css + mission-control.css importados</li>
            <li>✓ Componentes atom (Button, Card, Input, Label, Dialog, PageHeader)</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
