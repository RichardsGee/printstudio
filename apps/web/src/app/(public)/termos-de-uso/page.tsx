import type { Metadata } from 'next';
import Link from 'next/link';
import {
  LegalDocLayout,
  H2,
  H3,
  P,
  UL,
} from '@/components/marketing/legal-doc';

export const metadata: Metadata = {
  title: 'Termos de uso · GuiaPrint3D',
  description:
    'Termos e condições de uso da plataforma GuiaPrint3D. Direitos, deveres, limitações e responsabilidades.',
  alternates: { canonical: '/termos-de-uso' },
  robots: { index: true, follow: true },
};

/**
 * Termos de uso — template open-source adaptado pra GuiaPrint3D.
 * V1 mínima viable, Richard pode iterar com advogado depois.
 *
 * Story 7.4.
 */
export default function TermosUsoPage() {
  return (
    <LegalDocLayout
      id="TERMS-OF-USE"
      title="Termos de uso"
      description="Direitos e deveres ao usar a plataforma GuiaPrint3D. Ao usar o serviço, você concorda com estes termos."
      lastUpdated="2026-05-13"
    >
      <H2>1. Aceitação dos termos</H2>
      <P>
        Ao acessar ou usar o GuiaPrint3D, você concorda com estes Termos
        de Uso e com nossa{' '}
        <Link
          href="/politica-de-privacidade"
          className="underline hover:text-foreground"
        >
          Política de Privacidade
        </Link>
        . Se discordar de qualquer parte, não use o serviço.
      </P>

      <H2>2. Definições</H2>
      <UL>
        <li>
          <strong>Plataforma</strong>: o serviço de monitoramento remoto
          GuiaPrint3D, incluindo aplicação web, API e canais de
          comunicação.
        </li>
        <li>
          <strong>Usuário</strong>: pessoa física ou jurídica que utiliza
          a plataforma após cadastro.
        </li>
        <li>
          <strong>Conta</strong>: registro individual do Usuário, com
          credenciais únicas.
        </li>
        <li>
          <strong>Organização</strong>: tenant da plataforma, podendo ter
          uma ou mais impressoras vinculadas.
        </li>
      </UL>

      <H2>3. Conta e cadastro</H2>
      <UL>
        <li>Você deve ter 18 anos ou mais para criar uma conta</li>
        <li>
          As informações fornecidas no cadastro devem ser verdadeiras e
          atualizadas
        </li>
        <li>
          Você é responsável por manter a confidencialidade das suas
          credenciais
        </li>
        <li>
          Notifique-nos imediatamente em caso de acesso não autorizado
        </li>
        <li>
          Reservamo-nos o direito de recusar ou cancelar cadastros que
          violem estes termos
        </li>
      </UL>

      <H2>4. Uso aceitável</H2>
      <P>Você concorda em NÃO:</P>
      <UL>
        <li>Usar a plataforma para fins ilícitos ou não autorizados</li>
        <li>
          Tentar acessar áreas restritas, contas de outros usuários ou
          sistemas internos
        </li>
        <li>
          Realizar engenharia reversa, descompilar ou tentar extrair o
          código-fonte
        </li>
        <li>
          Sobrecarregar a infraestrutura com requisições excessivas (DDoS,
          scraping em massa)
        </li>
        <li>
          Vincular impressoras Bambu de terceiros sem autorização do
          proprietário
        </li>
        <li>
          Compartilhar credenciais de acesso com outras pessoas não
          autorizadas
        </li>
        <li>
          Usar a plataforma para violar direitos de propriedade
          intelectual
        </li>
      </UL>

      <H2>5. Propriedade intelectual</H2>
      <P>
        Todo conteúdo, código, marca, design, logo e materiais da
        plataforma são de propriedade exclusiva da GuiaPrint3D ou
        licenciados a ela. Você recebe apenas uma licença limitada,
        não-exclusiva e revogável de uso do serviço.
      </P>
      <P>
        Os dados que você insere (nome de impressora, configurações,
        histórico) continuam sendo seus. Você nos concede apenas
        autorização para processar e exibir esses dados conforme o serviço
        exige.
      </P>

      <H2>6. Planos e pagamento</H2>
      <H3>6.1 Plano gratuito (Free)</H3>
      <UL>
        <li>Limite de 1 impressora vinculada</li>
        <li>Retenção de histórico: 7 dias</li>
        <li>Funcionalidades reduzidas conforme tabela de planos</li>
      </UL>

      <H3>6.2 Planos pagos (Pro e Business)</H3>
      <UL>
        <li>
          Cobrança recorrente (mensal ou anual) processada via Asaas
        </li>
        <li>
          Pagamento via PIX, cartão de crédito ou boleto bancário
        </li>
        <li>Renovação automática a cada ciclo, salvo cancelamento prévio</li>
        <li>
          Preços e limites de cada plano disponíveis em{' '}
          <code className="text-caption font-mono">/settings/billing</code>
        </li>
      </UL>

      <H3>6.3 Cancelamento e reembolso</H3>
      <UL>
        <li>
          Você pode cancelar a assinatura a qualquer momento via painel da
          plataforma
        </li>
        <li>
          <strong>Direito de arrependimento (CDC Art. 49):</strong> nos
          primeiros <strong>7 dias</strong> após o primeiro pagamento,
          você tem direito a reembolso integral, sem necessidade de
          justificativa
        </li>
        <li>
          Após os 7 dias, não há reembolso. O serviço permanece ativo até
          o fim do ciclo de cobrança já pago
        </li>
        <li>
          Em caso de inadimplência, há período de tolerância de 7 dias
          antes da suspensão. Conta volta automaticamente ao plano Free,
          preservando dados por 90 dias
        </li>
      </UL>

      <H2>7. Disponibilidade</H2>
      <P>
        Buscamos manter a plataforma disponível 24/7, mas não garantimos
        uptime de 100%. Manutenções programadas serão comunicadas com
        antecedência. Interrupções não programadas serão informadas via
        canais oficiais.
      </P>
      <P>
        A funcionalidade depende da disponibilidade de serviços de
        terceiros (Bambu Cloud, Asaas, EasyPanel). Não nos
        responsabilizamos por falhas desses serviços externos.
      </P>

      <H2>8. Limitação de responsabilidade</H2>
      <P>
        O GuiaPrint3D é uma ferramenta de monitoramento e gestão.{' '}
        <strong>
          Não nos responsabilizamos por danos materiais decorrentes do uso
          ou mau uso da impressora física
        </strong>{' '}
        (queima, incêndio, falha de hardware, etc.). A responsabilidade
        pela operação segura da impressora é exclusiva do operador.
      </P>
      <P>
        Em qualquer caso, nossa responsabilidade total fica limitada ao
        valor pago nos últimos 12 meses pelo plano.
      </P>

      <H2>9. Modificações no serviço</H2>
      <P>
        Reservamo-nos o direito de modificar, suspender ou descontinuar
        funcionalidades a qualquer momento. Mudanças significativas serão
        comunicadas com pelo menos 30 dias de antecedência aos usuários
        ativos.
      </P>

      <H2>10. Modificações nos termos</H2>
      <P>
        Estes termos podem ser atualizados. A data de “última
        atualização” no topo indica a versão atual. Mudanças relevantes
        serão comunicadas por email com pelo menos 7 dias de antecedência.
        Uso continuado após a notificação implica aceite.
      </P>

      <H2>11. Foro e legislação aplicável</H2>
      <P>
        Estes termos são regidos pelas leis brasileiras. Fica eleito o
        foro da comarca da sede do GuiaPrint3D (cidade a ser definida no
        registro do MEI) para resolução de quaisquer litígios, com
        renúncia expressa a qualquer outro, por mais privilegiado que
        seja.
      </P>

      <H2>12. Contato</H2>
      <P>
        Dúvidas, sugestões ou denúncias:{' '}
        <code className="text-caption font-mono text-primary">
          suporte@guiaprint3d.com
        </code>
      </P>

      <P className="pt-6 border-t border-[var(--mc-accent-soft)]/30">
        Veja também:{' '}
        <Link
          href="/politica-de-privacidade"
          className="underline hover:text-foreground"
        >
          Política de Privacidade
        </Link>
        .
      </P>
    </LegalDocLayout>
  );
}
