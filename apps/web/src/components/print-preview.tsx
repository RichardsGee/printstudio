'use client';

import { useState } from 'react';
import { Image as ImageIcon, Box } from 'lucide-react';
import { ThumbnailPreview } from './thumbnail-preview';
import { LayerView } from './layer-view';
import { cn } from '@/lib/utils';

interface Props {
  printerId: string;
  cacheKey?: string | null;
  currentLayer?: number | null;
  totalLayers?: number | null;
  filamentColor?: string | null;
  className?: string;
}

type Mode = 'thumbnail' | 'layers';

/**
 * Preview do trabalho atual — alterna entre o thumbnail renderizado
 * pelo Bambu Studio (default) e a visualização 3D das camadas feita
 * por nós a partir do gcode. Thumbnail é default porque é leve e
 * familiar; 3D é opt-in pra quem quer ver o progresso camada a camada.
 */
export function PrintPreview({
  printerId,
  cacheKey,
  currentLayer,
  totalLayers,
  filamentColor,
  className,
}: Props) {
  const [mode, setMode] = useState<Mode>('thumbnail');

  return (
    <div className={cn('relative', className)}>
      {/* Toggle no topo */}
      <div className="absolute top-1.5 left-1.5 z-10 flex rounded-md bg-background/75 backdrop-blur border border-border/60 p-0.5 text-[10px] font-mono">
        <ModeButton
          active={mode === 'thumbnail'}
          onClick={() => setMode('thumbnail')}
          icon={ImageIcon}
          label="Foto"
        />
        <ModeButton
          active={mode === 'layers'}
          onClick={() => setMode('layers')}
          icon={Box}
          label="3D"
        />
      </div>

      {mode === 'thumbnail' ? (
        <ThumbnailPreview printerId={printerId} cacheKey={cacheKey} />
      ) : (
        <LayerView
          printerId={printerId}
          cacheKey={cacheKey}
          currentLayer={currentLayer}
          totalLayers={totalLayers}
          filamentColor={filamentColor}
        />
      )}
    </div>
  );
}

function ModeButton({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ElementType;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex items-center gap-1 px-1.5 py-0.5 rounded transition-colors',
        active
          ? 'bg-primary text-primary-foreground'
          : 'text-muted-foreground hover:text-foreground',
      )}
    >
      <Icon className="h-3 w-3" />
      {label}
    </button>
  );
}
