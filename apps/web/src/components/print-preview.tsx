'use client';

import { useState } from 'react';
import { Image as ImageIcon, Box, Sparkles } from 'lucide-react';
import { ThumbnailPreview } from './thumbnail-preview';
import { LayerView } from './layer-view';
import { RealisticPreview3D } from './realistic-preview-3d';
import { cn } from '@/lib/utils';

interface Props {
  printerId: string;
  cacheKey?: string | null;
  currentLayer?: number | null;
  totalLayers?: number | null;
  progressPct?: number | null;
  filamentColor?: string | null;
  /** Story 4.7: vista isométrica (pick_1.png) da Bambu Cloud — fallback
   *  no modo "Real" quando não há .3mf cached. */
  cloudPickUrl?: string | null;
  /** Story 4.8: bambu_model_id da impressão atual. Quando presente,
   *  RealisticPreview3D busca mesh em /api/cached-models antes do
   *  bridge LAN. */
  cloudBambuModelId?: string | null;
  /** Story 4.9: plate atual sendo impresso (1-based). */
  cloudPlateIndex?: number | null;
  className?: string;
}

type Mode = 'thumbnail' | 'layers' | 'realistic';

/**
 * Preview do trabalho atual — três modos:
 *  - Foto: thumbnail PNG renderizado pelo Bambu Studio
 *  - Fatias: toolpaths empilhados em isométrico (do gcode)
 *  - Real: render 3D do mesh do .3mf que o usuário subiu, com
 *    clipping plane que sobe conforme as camadas avançam
 */
export function PrintPreview({
  printerId,
  cacheKey,
  currentLayer,
  totalLayers,
  progressPct,
  filamentColor,
  cloudPickUrl,
  cloudBambuModelId,
  cloudPlateIndex,
  className,
}: Props) {
  const [mode, setMode] = useState<Mode>('thumbnail');

  return (
    <div className={cn('relative', className)}>
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
          label="Fatias"
        />
        <ModeButton
          active={mode === 'realistic'}
          onClick={() => setMode('realistic')}
          icon={Sparkles}
          label="Real"
        />
      </div>

      {mode === 'thumbnail' ? (
        <ThumbnailPreview printerId={printerId} cacheKey={cacheKey} />
      ) : mode === 'layers' ? (
        <LayerView
          printerId={printerId}
          cacheKey={cacheKey}
          currentLayer={currentLayer}
          totalLayers={totalLayers}
          filamentColor={filamentColor}
        />
      ) : (
        <RealisticPreview3D
          printerId={printerId}
          currentLayer={currentLayer}
          totalLayers={totalLayers}
          progressPct={progressPct}
          filamentColor={filamentColor}
          cloudPickUrl={cloudPickUrl}
          cloudBambuModelId={cloudBambuModelId}
          cloudPlateIndex={cloudPlateIndex}
          className="aspect-square"
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
