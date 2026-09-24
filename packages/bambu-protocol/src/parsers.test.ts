import { describe, it, expect } from 'vitest';
import { applyReport, emptyState, parseHmsError, printErrorMessage } from './parsers.js';
import { HMS_MESSAGES_PT_BR, PRINT_ERROR_MESSAGES_PT_BR } from './hms-messages.pt-BR.js';

/**
 * HMS e print_error são o diagnóstico que o operador lê quando a
 * impressora para. O código tem de sair no formato oficial (o mesmo do app
 * Bambu) e a mensagem, da base oficial — nunca de tabela escrita à mão.
 */

describe('parseHmsError', () => {
  it('formata attr+code em 4 grupos com zero à esquerda', () => {
    const e = parseHmsError({ attr: 0x07000100, code: 0x00010001 });
    expect(e?.code).toBe('HMS_0700_0100_0001_0001');
  });

  it('preenche zero em attr pequeno', () => {
    expect(parseHmsError({ attr: 0x0300, code: 0x00040001 })?.code).toBe('HMS_0000_0300_0004_0001');
  });

  it('usa a mensagem oficial pt-BR do código', () => {
    const e = parseHmsError({ attr: 0x07000100, code: 0x00010001 });
    expect(e?.message).toBe(HMS_MESSAGES_PT_BR['0700010000010001']);
    expect(e?.message).toMatch(/AMS/);
  });

  it('código fora da base sai sem mensagem (a UI mostra o código cru)', () => {
    const e = parseHmsError({ attr: 0x7fff0000, code: 0x0001ffff });
    expect(e).toEqual({ code: 'HMS_7FFF_0000_0001_FFFF', severity: 'fatal' });
  });

  it.each([
    [0x00010001, 'fatal'],
    [0x00020001, 'error'],
    [0x00030001, 'warning'],
    [0x00040001, 'info'],
    [0x00000001, 'warning'],
  ] as const)('severidade vem de code >> 16 (code=0x%s)', (code, severity) => {
    expect(parseHmsError({ attr: 0x05000100, code })?.severity).toBe(severity);
  });

  it('ignora item incompleto', () => {
    expect(parseHmsError({ attr: 0x07000100 })).toBeNull();
  });
});

describe('print_error', () => {
  it('resolve a mensagem oficial', () => {
    expect(printErrorMessage(0x10014001)).toBe(PRINT_ERROR_MESSAGES_PT_BR['10014001']);
  });

  it('0 e null não têm mensagem', () => {
    expect(printErrorMessage(0)).toBeNull();
    expect(printErrorMessage(null)).toBeNull();
  });

  it('applyReport leva código e mensagem juntos e limpa com 0', () => {
    const s1 = applyReport(emptyState('p'), { print: { print_error: 0x10014001 } });
    expect(s1.printErrorCode).toBe(0x10014001);
    expect(s1.printErrorMessage).toBe(PRINT_ERROR_MESSAGES_PT_BR['10014001']);
    const s2 = applyReport(s1, { print: { print_error: 0 } });
    expect(s2.printErrorCode).toBeNull();
    expect(s2.printErrorMessage).toBeNull();
  });
});

describe('etapa (stage)', () => {
  const printing = { gcode_state: 'RUNNING' };

  it('etapa de preparação na 1ª camada aparece', () => {
    const s = applyReport(emptyState('p'), {
      print: { ...printing, mc_print_stage: '2', layer_num: 1 },
    });
    expect(s.stage).toBe('Nivelando mesa');
  });

  it('etapa de preparação presa depois da 1ª camada some', () => {
    const s = applyReport(emptyState('p'), {
      print: { ...printing, mc_print_stage: '2', layer_num: 27 },
    });
    expect(s.stage).toBeNull();
  });

  it('camada vinda de relatório anterior também conta', () => {
    const s1 = applyReport(emptyState('p'), { print: { ...printing, layer_num: 14 } });
    const s2 = applyReport(s1, { print: { mc_print_stage: '2' } });
    expect(s2.stage).toBeNull();
  });

  it('etapa que acontece no meio do print continua', () => {
    const s = applyReport(emptyState('p'), {
      print: { ...printing, stg_cur: 4, layer_num: 80 },
    });
    expect(s.stage).toBe('Trocando filamento');
  });
});

describe('tabela oficial', () => {
  it('tem as duas seções com chaves hex válidas', () => {
    const hms = Object.keys(HMS_MESSAGES_PT_BR);
    const pe = Object.keys(PRINT_ERROR_MESSAGES_PT_BR);
    expect(hms.length).toBeGreaterThan(1000);
    expect(pe.length).toBeGreaterThan(100);
    expect(hms.every((k) => /^[0-9A-F]{16}$/.test(k))).toBe(true);
    expect(pe.every((k) => /^[0-9A-F]{8}$/.test(k))).toBe(true);
  });
});

describe('printerCapabilities (shared)', () => {
  it.each([
    ['A1', false, false],
    ['A1 mini', false, false],
    ['P1S', false, true],
    ['X1 Carbon', true, true],
    ['modelo-novo', true, true],
  ] as const)('%s → câmara=%s ventoinha aux=%s', async (model, chamberTemp, auxFan) => {
    const { printerCapabilities } = await import('@printstudio/shared');
    expect(printerCapabilities(model)).toMatchObject({ chamberTemp, auxFan });
  });
});
