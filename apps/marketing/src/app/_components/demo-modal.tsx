'use client';

import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

/**
 * URL do video demo. Placeholder até Richard gravar o video real.
 * Forma `embed` é obrigatória pra iframe.
 */
const DEMO_VIDEO_URL = 'https://www.youtube.com/embed/dQw4w9WgXcQ';

interface DemoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Modal de demo. Iframe responsivo 16:9 do video YouTube.
 * Fechamento pelo botão X já vem do DialogContent.
 */
export function DemoModal({ open, onOpenChange }: DemoModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl p-4 sm:p-6">
        <DialogTitle className="text-body uppercase tracking-wider">
          Demo · GuiaPrint3D em 60 segundos
        </DialogTitle>
        <DialogDescription>
          Tour rápido pela visão Mission Control monitorando 3 Bambu A1.
        </DialogDescription>
        <div className="relative aspect-video w-full overflow-hidden rounded-md bg-black">
          {open && (
            <iframe
              src={`${DEMO_VIDEO_URL}?autoplay=1&rel=0&modestbranding=1`}
              title="Demo GuiaPrint3D"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="absolute inset-0 size-full"
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
