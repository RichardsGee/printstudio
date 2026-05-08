'use client';

import { useEffect, useRef, useState } from 'react';
import { Upload, FileBox, Trash2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import { getBridgeBase } from '@/lib/bridge-url';

interface ModelMeta {
  originalName: string;
  uploadedAt: number;
  size: number;
}

interface Props {
  printerId: string;
  className?: string;
}

/**
 * Vincula um arquivo .3mf ORIGINAL (com mesh) a uma impressora.
 * O .3mf que fica na FTP da impressora não tem geometria — Bambu
 * Studio strip o mesh antes de mandar pra impressão. Pra render
 * realista (3D real do objeto, com clipping plane por camada), o
 * usuário precisa subir o .3mf que ele tem no PC.
 */
export function ModelLink({ printerId, className }: Props) {
  const [meta, setMeta] = useState<ModelMeta | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const fetchInfo = async (): Promise<void> => {
    try {
      const r = await fetch(
        `${getBridgeBase()}/api/printers/${printerId}/uploaded-model.info`,
      );
      if (r.ok) setMeta(await r.json());
      else setMeta(null);
    } catch {
      setMeta(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    void fetchInfo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [printerId]);

  async function handleUpload(file: File): Promise<void> {
    if (!/\.3mf$/i.test(file.name)) {
      toast.error('Arquivo precisa ser .3mf');
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const r = await fetch(
        `${getBridgeBase()}/api/printers/${printerId}/upload-model`,
        { method: 'POST', body: fd },
      );
      if (!r.ok) {
        const err = await r.json().catch(() => ({ error: `HTTP ${r.status}` }));
        throw new Error(err.error ?? 'upload falhou');
      }
      const data = (await r.json()) as ModelMeta;
      setMeta(data);
      toast.success(`Modelo vinculado: ${data.originalName}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha no upload');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  async function handleRemove(): Promise<void> {
    setUploading(true);
    try {
      await fetch(
        `${getBridgeBase()}/api/printers/${printerId}/uploaded-model`,
        { method: 'DELETE' },
      );
      setMeta(null);
      toast.message('Modelo desvinculado');
    } catch {
      toast.error('Falha ao remover');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <input
        ref={inputRef}
        type="file"
        accept=".3mf"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleUpload(f);
        }}
      />

      {loading ? (
        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Verificando…
        </span>
      ) : meta ? (
        <>
          <span
            className="inline-flex items-center gap-1.5 rounded-md border border-success/40 bg-success/10 px-2 py-1 text-xs text-success"
            title={`${meta.originalName} · ${(meta.size / 1024 / 1024).toFixed(1)} MB`}
          >
            <FileBox className="h-3.5 w-3.5" />
            <span className="max-w-[160px] truncate font-medium">
              {meta.originalName}
            </span>
          </span>
          <Button
            size="sm"
            variant="outline"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
          >
            <Upload className="h-3.5 w-3.5 mr-1.5" />
            Trocar
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => void handleRemove()}
            disabled={uploading}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </>
      ) : (
        <Button
          size="sm"
          variant="outline"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? (
            <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
          ) : (
            <Upload className="h-3.5 w-3.5 mr-1.5" />
          )}
          Vincular .3mf
        </Button>
      )}
    </div>
  );
}
