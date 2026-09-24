import { describe, it, expect } from 'vitest';
import { cn } from './utils';

/**
 * `cn()` sustenta todas as primitivas do design system (Metric, Chip,
 * SectionLabel…). Sem a escala tipográfica registrada no tailwind-merge,
 * `text-caption` era lido como cor e o merge apagava cor ou tamanho.
 */

const SIZES = ['micro', 'caption', 'small', 'body', 'body-lg', 'heading', 'display'];

describe('cn — escala tipográfica do DS', () => {
  it.each(SIZES)('text-%s convive com uma cor', (size) => {
    expect(cn('text-muted-foreground', `text-${size}`)).toBe(`text-muted-foreground text-${size}`);
    expect(cn(`text-${size}`, 'text-foreground')).toBe(`text-${size} text-foreground`);
  });

  it('tamanho novo substitui o anterior', () => {
    expect(cn('text-caption', 'text-body')).toBe('text-body');
    expect(cn('text-sm', 'text-caption')).toBe('text-caption');
  });

  it('cor nova substitui a anterior sem tocar no tamanho', () => {
    expect(cn('text-caption text-muted-foreground', 'text-mc-accent')).toBe(
      'text-caption text-mc-accent',
    );
  });
});

describe('cn — tokens do Mission Control', () => {
  it('borda mc com opacidade substitui a borda padrão', () => {
    expect(cn('border-border', 'border-mc-accent-soft/30')).toBe('border-mc-accent-soft/30');
  });

  it('sombra elev convive com cor de sombra e substitui outra sombra', () => {
    expect(cn('shadow-md', 'shadow-elev-2')).toBe('shadow-elev-2');
    expect(cn('shadow-elev-1', 'shadow-primary/20')).toBe('shadow-elev-1 shadow-primary/20');
  });
});
