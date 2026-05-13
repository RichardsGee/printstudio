import type { Metadata } from 'next';
import Link from 'next/link';
import {
  LegalDocLayout,
  H2,
  P,
  UL,
} from '@/components/marketing/legal-doc';

export const metadata: Metadata = {
  title: 'Política de Privacidade · GuiaPrint3D',
  description:
    'Política de privacidade do GuiaPrint3D. Como coletamos, usamos, armazenamos e protegemos seus dados pessoais conforme LGPD.',
  alternates: { canonical: '/politica-de-privacidade' },
  robots: { index: true, follow: true },
};

/**
 * Política de privacidade — template open-source adaptado pra
 * PrintStudio/GuiaPrint3D, alinhado com LGPD mínimo (PRD 7 decisão).
 *
 * Story 7.4. V1 mínima viable — Richard pode iterar com advogado.
 */
export default function PoliticaPrivacidadePage() {
  return (
    <LegalDocLayout
      id="PRIVACY-POLICY"
      title="Política de privacidade"
      description="Como tratamos seus dados pessoais no GuiaPrint3D, em conformidade com a LGPD (Lei 13.709/2018)."
      lastUpdated="2026-05-13"
    >
      <H2>1. Quem somos</H2>
      <P>
        GuiaPrint3D é a plataforma de monitoramento remoto de impressoras
        3D Bambu Lab, operada por Richard (MEI a ser registrado). Esta
        política descreve como coletamos, usamos, armazenamos e protegemos
        seus dados pessoais.
      </P>

      <H2>2. Dados coletados</H2>
      <P>
        Quando você se cadastra na lista de espera ou usa a plataforma,
        podemos coletar:
      </P>
      <UL>
        <li>
          <strong>Nome e email</strong> — para identificação e contato
        </li>
        <li>
          <strong>Telefone (WhatsApp) ou Telegram</strong> — opcional, para
          contato direto
        </li>
        <li>
          <strong>Estado e cidade</strong> — para entender distribuição
          geográfica dos usuários
        </li>
        <li>
          <strong>Perfil de uso</strong> — hobbyista, print shop, estúdio,
          etc.
        </li>
        <li>
          <strong>Quantidade de impressoras Bambu</strong> — para
          dimensionamento do produto
        </li>
        <li>
          <strong>Endereço IP</strong> — para prevenção de spam (rate
          limit) e analytics agregado
        </li>
        <li>
          <strong>Origem do tráfego (UTM)</strong> — para entender quais
          canais de marketing funcionam
        </li>
        <li>
          <strong>User agent (navegador)</strong> — para compatibilidade
        </li>
        <li>
          <strong>Dados fiscais (CPF/CNPJ, endereço)</strong> — apenas se
          você fizer upgrade pra plano pago, para emissão de NFS-e
        </li>
      </UL>

      <H2>3. Finalidade do tratamento</H2>
      <P>Usamos seus dados exclusivamente para:</P>
      <UL>
        <li>
          Comunicar atualizações sobre o produto (lançamento, novas
          features)
        </li>
        <li>Realizar contato comercial qualificado</li>
        <li>Prestar o serviço contratado (monitorar suas impressoras)</li>
        <li>Emitir cobranças e NFS-e (apenas planos pagos)</li>
        <li>Prevenir fraudes e abuso (rate limit, detecção de bot)</li>
        <li>Análise estatística agregada (sem identificação individual)</li>
      </UL>

      <H2>4. Base legal</H2>
      <P>
        Tratamos seus dados com base nas seguintes hipóteses legais (Art.
        7º da LGPD):
      </P>
      <UL>
        <li>
          <strong>Consentimento</strong> — você aceita esta política ao se
          cadastrar na waitlist
        </li>
        <li>
          <strong>Execução de contrato</strong> — quando você assina um
          plano pago
        </li>
        <li>
          <strong>Legítimo interesse</strong> — prevenção de fraudes,
          analytics agregado
        </li>
        <li>
          <strong>Obrigação legal</strong> — emissão de NF, dados fiscais
          obrigatórios
        </li>
      </UL>

      <H2>5. Compartilhamento</H2>
      <P>
        <strong>Não vendemos seus dados.</strong> Compartilhamos apenas
        com:
      </P>
      <UL>
        <li>
          <strong>Asaas</strong> (gateway de pagamento) — para processar
          cobranças, apenas dados fiscais necessários
        </li>
        <li>
          <strong>Provedor de NF</strong> (eNotas, NFe.io ou Asaas) — para
          emissão de NFS-e
        </li>
        <li>
          <strong>EasyPanel</strong> (infra de hosting) — armazenamento
          dos dados em servidor BR
        </li>
        <li>
          <strong>Autoridades</strong> — apenas mediante ordem judicial
        </li>
      </UL>

      <H2>6. Retenção</H2>
      <UL>
        <li>
          <strong>Waitlist não convertida:</strong> 90 dias após último
          contato. Depois, anonimização ou exclusão
        </li>
        <li>
          <strong>Conta ativa:</strong> enquanto a conta existir
        </li>
        <li>
          <strong>Conta cancelada:</strong> 30 dias para reativação, depois
          dados pessoais são anonimizados (exceto registros fiscais que a
          legislação exige guardar por 5 anos)
        </li>
        <li>
          <strong>Histórico de impressão e telemetria:</strong> conforme
          retenção do plano (Free: 7 dias, Pro: 30 dias, Business: 365 dias)
        </li>
      </UL>

      <H2>7. Seus direitos (LGPD Art. 18)</H2>
      <P>Você pode, a qualquer momento, solicitar:</P>
      <UL>
        <li>Confirmação da existência de tratamento dos seus dados</li>
        <li>Acesso aos seus dados</li>
        <li>Correção de dados incompletos ou desatualizados</li>
        <li>
          Anonimização, bloqueio ou eliminação de dados desnecessários
        </li>
        <li>Portabilidade dos dados (exportação CSV)</li>
        <li>Eliminação dos dados tratados com consentimento</li>
        <li>Revogação do consentimento</li>
      </UL>
      <P>
        Para exercer esses direitos, envie um email para{' '}
        <code className="text-caption font-mono text-primary">
          suporte@guiaprint3d.com
        </code>
        . Respondemos em até 15 dias.
      </P>

      <H2>8. Segurança</H2>
      <UL>
        <li>Senhas armazenadas com hash forte (Argon2)</li>
        <li>
          Tokens de terceiros (Bambu Cloud, Asaas) criptografados em
          repouso (AES-256-GCM)
        </li>
        <li>Comunicação sempre via HTTPS</li>
        <li>Banco de dados com acesso restrito por IP</li>
        <li>Backups regulares com retenção de 30 dias</li>
      </UL>

      <H2>9. Cookies</H2>
      <P>
        O site marketing (guiaprint3d.com) usa cookies essenciais para
        funcionamento. Não usamos cookies de tracking de terceiros (Google
        Analytics, Facebook Pixel) no momento. Se mudarmos isso,
        atualizaremos esta política e pediremos seu consentimento.
      </P>

      <H2>10. Crianças e adolescentes</H2>
      <P>
        O GuiaPrint3D não é destinado a menores de 18 anos. Não coletamos
        intencionalmente dados de menores. Se você é responsável legal e
        suspeita que coletamos dados de um menor, entre em contato.
      </P>

      <H2>11. Alterações</H2>
      <P>
        Esta política pode ser atualizada. A data de “última atualização”
        no topo indica a versão atual. Mudanças relevantes serão
        comunicadas por email aos usuários ativos com pelo menos 7 dias
        de antecedência.
      </P>

      <H2>12. Contato</H2>
      <P>
        Encarregado pelo tratamento de dados (DPO): Richard.
        <br />
        Email:{' '}
        <code className="text-caption font-mono text-primary">
          suporte@guiaprint3d.com
        </code>
      </P>

      <P className="pt-6 border-t border-[var(--mc-accent-soft)]/30">
        Veja também:{' '}
        <Link
          href="/termos-de-uso"
          className="underline hover:text-foreground"
        >
          Termos de uso
        </Link>
        .
      </P>
    </LegalDocLayout>
  );
}
