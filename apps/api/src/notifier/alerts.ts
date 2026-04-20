import type { PrinterState, HmsError } from '@printstudio/shared';
import { lookupHmsCode } from '@printstudio/shared';
import { logger } from '../logger.js';
import { sendTelegramMessage } from './telegram.js';

/**
 * Despachante central de alertas derivados do estado da impressora.
 * Acumula o último estado observado por printer e emite notificações
 * quando detecta TRANSIÇÕES dignas de alerta — não re-dispara em loop
 * enquanto o estado permanecer o mesmo.
 *
 * Regras atuais:
 * 1. HMS de severidade `fatal` ou `error` novo (código que não estava
 *    na lista anterior) → alerta crítico.
 * 2. Status IDLE/PRINTING → FAILED → alerta de falha.
 * 3. Status PRINTING → FINISH → notificação de conclusão.
 * 4. Porta fechada → aberta → alerta de segurança.
 *
 * Config: depende de `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID`. Se não
 * configurado, só loga no console.
 */

interface Snapshot {
  status: PrinterState['status'];
  doorOpen: boolean | null;
  hmsKeys: string;
}

const lastSnapshot = new Map<string, Snapshot>();

function printerLabel(state: PrinterState, nameMap: Map<string, string>): string {
  return nameMap.get(state.printerId) ?? state.printerId.slice(0, 8);
}

function hmsToText(errors: HmsError[]): string {
  if (errors.length === 0) return '';
  const critical = errors.filter((e) => e.severity === 'fatal' || e.severity === 'error');
  return critical
    .map((e) => {
      const info = lookupHmsCode(e.code);
      return `- *${info?.title ?? e.code}* (${e.severity})`;
    })
    .join('\n');
}

export function processStateAlerts(
  state: PrinterState,
  nameMap: Map<string, string>,
): void {
  const prev = lastSnapshot.get(state.printerId);
  const label = printerLabel(state, nameMap);

  const criticalHms = state.hmsErrors.filter(
    (e) => e.severity === 'fatal' || e.severity === 'error',
  );
  const hmsKeys = criticalHms
    .map((e) => e.code)
    .sort()
    .join(',');

  // Novos erros HMS críticos aparecendo em relação ao snapshot anterior
  const prevHmsSet = new Set(prev?.hmsKeys ? prev.hmsKeys.split(',').filter(Boolean) : []);
  const newCritical = criticalHms.filter((e) => !prevHmsSet.has(e.code));

  if (newCritical.length > 0) {
    const text =
      `🚨 *${label}* — erro crítico detectado\n\n` +
      hmsToText(newCritical) +
      `\n\n_Verifique a impressora imediatamente._`;
    void sendTelegramMessage(text);
    logger.warn({ printerId: state.printerId, codes: newCritical.map((e) => e.code) }, 'ALERT: HMS critical');
  }

  // Transições de status
  if (prev && prev.status !== state.status) {
    if (state.status === 'FAILED') {
      void sendTelegramMessage(
        `❌ *${label}* — impressão falhou\n` +
          (state.currentFile ? `Arquivo: \`${state.currentFile}\`\n` : '') +
          (state.stateChangeReason ? `Motivo: ${state.stateChangeReason}` : ''),
      );
    } else if (state.status === 'FINISH' && prev.status === 'PRINTING') {
      void sendTelegramMessage(
        `✅ *${label}* — impressão concluída\n` +
          (state.currentFile ? `Arquivo: \`${state.currentFile}\`` : ''),
      );
    }
  }

  // Porta — fechada → aberta
  if (prev && prev.doorOpen === false && state.doorOpen === true) {
    void sendTelegramMessage(`⚠️ *${label}* — porta aberta durante operação`);
  }

  lastSnapshot.set(state.printerId, {
    status: state.status,
    doorOpen: state.doorOpen,
    hmsKeys,
  });
}
