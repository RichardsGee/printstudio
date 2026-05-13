import { PageHeader } from '@/components/ui/page-header';
import { BambuConnectFlow } from '@/components/bambu/bambu-connect-flow';

/**
 * Página standalone de conexão Bambu Cloud (Epic 4).
 *
 * Wrapper minimal sobre `BambuConnectFlow` — todo o flow (email →
 * código → success) vive no component reutilizável, que também é
 * usado pelo wizard de onboarding (Story 8.4).
 */
export default function BambuConnectPage() {
  return (
    <div className="container max-w-xl py-8 space-y-6">
      <PageHeader
        id="BAMBU"
        title="Conectar conta Bambu Cloud"
        description="Permite que o PrintStudio receba telemetria das impressoras direto da nuvem da Bambu, sem precisar de um bridge LAN."
      />
      <BambuConnectFlow />
    </div>
  );
}
