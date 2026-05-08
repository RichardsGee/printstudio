'use client';

import { useEffect, useState } from 'react';
import { Maximize, Minimize } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  className?: string;
}

/**
 * Botão fullscreen pra modo kiosk em tablet/monitor. Usa a Fullscreen
 * API nativa do browser (funciona em Chrome/Safari/Firefox modernos).
 *
 * No iOS Safari não tem suporte direto — sugestão: "Adicionar à Tela
 * de Início" no Safari pra rodar em standalone PWA-style.
 */
export function KioskFullscreenButton({ className }: Props) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [supported, setSupported] = useState(true);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (!document.documentElement.requestFullscreen) {
      setSupported(false);
      return;
    }
    const onChange = (): void => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  if (!supported) return null;

  const toggle = async (): Promise<void> => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await document.documentElement.requestFullscreen();
      }
    } catch {
      /* ignora rejeições (usuário pode ter negado a permissão) */
    }
  };

  return (
    <button
      type="button"
      onClick={() => void toggle()}
      className={cn(
        'inline-flex items-center justify-center rounded-md border border-border/60 bg-card/60 backdrop-blur',
        'hover:bg-card transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        'h-9 w-9',
        className,
      )}
      aria-label={isFullscreen ? 'Sair da tela cheia' : 'Tela cheia'}
      title={isFullscreen ? 'Sair da tela cheia' : 'Tela cheia'}
    >
      {isFullscreen ? (
        <Minimize className="h-4 w-4" />
      ) : (
        <Maximize className="h-4 w-4" />
      )}
    </button>
  );
}
