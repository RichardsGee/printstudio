/**
 * Mapa de códigos HMS (Health Management System) Bambu → descrição em PT-BR.
 *
 * O parser gera códigos no formato `HMS_{attr-hex}_{code-hex}`, combinando os
 * campos `attr` e `code` recebidos via MQTT. A lista cobre os erros mais
 * comuns do modelo A1 — códigos desconhecidos retornam `null` e a UI
 * apresenta apenas o código cru e a severidade.
 *
 * Referência: https://e.bambulab.com/query.php?lang=pt (base oficial de
 * troubleshooting Bambu).
 */

export interface HmsCodeInfo {
  title: string;
  hint?: string;
}

export const HMS_CODES: Record<string, HmsCodeInfo> = {
  // --- Filamento / AMS ---
  HMS_0300_0001_0001_0001: {
    title: 'Filamento acabou no AMS',
    hint: 'Troque a bobina ou carregue outra slot.',
  },
  HMS_0300_0002_0001_0001: {
    title: 'Filamento enroscado no AMS',
    hint: 'Abra o AMS e verifique o caminho do filamento.',
  },
  HMS_0300_0002_0002_0001: {
    title: 'Erro de carregamento de filamento',
    hint: 'O AMS não conseguiu alimentar o filamento no extrusor.',
  },
  HMS_0300_0003_0001_0001: {
    title: 'Filamento não detectado',
    hint: 'Verifique se a ponta está bem inserida na slot.',
  },

  // --- Bico / Extrusor ---
  HMS_0500_0100_0001_0001: {
    title: 'Temperatura do bico abaixo do esperado',
    hint: 'Pode indicar aquecedor ou termistor com problema.',
  },
  HMS_0500_0100_0002_0001: {
    title: 'Temperatura do bico acima do esperado',
    hint: 'Verifique ventoinha e cooling do hotend.',
  },
  HMS_0500_0200_0001_0001: {
    title: 'Possível entupimento do bico',
    hint: 'Limpe o bico e verifique se o filamento está saindo.',
  },
  HMS_0500_0300_0001_0001: {
    title: 'Pulando passos no extrusor',
    hint: 'Força excessiva — pode ser entupimento ou filamento ruim.',
  },

  // --- Mesa aquecida ---
  HMS_0700_0100_0001_0001: {
    title: 'Mesa não está aquecendo',
    hint: 'Verifique conexão do aquecedor e termistor da mesa.',
  },
  HMS_0700_0100_0002_0001: {
    title: 'Temperatura da mesa muito alta',
  },

  // --- Estrutura / Calibração ---
  HMS_0C00_0100_0001_0001: {
    title: 'Falha no auto bed-leveling',
    hint: 'Limpe a mesa e verifique se ela está fixada corretamente.',
  },
  HMS_0C00_0200_0001_0001: {
    title: 'Z-offset fora do esperado',
  },
  HMS_0C00_0300_0001_0001: {
    title: 'Colisão detectada',
    hint: 'Verifique obstruções na mesa ou na cabeça de impressão.',
  },

  // --- Câmera / Monitoramento ---
  HMS_1000_0100_0001_0001: {
    title: 'Falha em detecção visual (spaghetti detection)',
    hint: 'A câmera detectou algo anormal na peça em impressão.',
  },

  // --- Conectividade / Sistema ---
  HMS_0300_1000_0001_0001: {
    title: 'AMS desconectado',
    hint: 'Verifique cabo entre impressora e AMS.',
  },
  HMS_1100_0100_0001_0001: {
    title: 'Falha no storage interno',
  },
};

/**
 * Lookup tolerante — o parser atual gera `HMS_{attr}_{code}` (4 hex tokens no
 * total). A tabela acima usa o formato completo, mas fallbacks por prefixo
 * podem ser adicionados futuramente se necessário.
 */
export function lookupHmsCode(code: string): HmsCodeInfo | null {
  return HMS_CODES[code] ?? null;
}
