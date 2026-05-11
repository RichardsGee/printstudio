'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Check, GripVertical, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import type { PrinterState } from '@printstudio/shared';
import { useConnection } from '@/lib/connection';
import { WsClient } from '@/lib/ws-client';
import { usePrinterStore } from '@/lib/store';
import { useWakeLock } from '@/lib/use-wake-lock';
import { Button } from '@/components/ui/button';
import { KioskPrinterCard } from '@/components/kiosk/kiosk-printer-card';
import { KioskStatusBanner } from '@/components/kiosk/kiosk-status-banner';
import { reorderPrintersAction } from '@/app/(app)/settings/printers/actions';

interface PrinterRow {
  id: string;
  name: string;
}

interface Props {
  printers: PrinterRow[];
}

export function KioskClient({ printers }: Props) {
  useWakeLock(true);

  const { wsUrl, detecting } = useConnection();
  const states = usePrinterStore((s) => s.states);
  const setState = usePrinterStore((s) => s.setState);
  const pushEvent = usePrinterStore((s) => s.pushEvent);
  const clientRef = useRef<WsClient | null>(null);

  // Cópia local da ordem — em edit mode reordena visualmente antes
  // de salvar; ao confirmar, dispara reorderPrintersAction.
  const [order, setOrder] = useState<PrinterRow[]>(printers);
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);

  // Sincroniza a ordem local quando a prop muda (revalidatePath dispara
  // refetch no servidor após save). Só substitui se não estiver editando.
  useEffect(() => {
    if (!editMode) setOrder(printers);
  }, [printers, editMode]);

  const ids = useMemo(() => order.map((p) => p.id), [order]);

  useEffect(() => {
    if (detecting || ids.length === 0) return;

    const client = new WsClient(wsUrl);
    clientRef.current = client;
    const off = client.onMessage((msg) => {
      if (msg.type === 'printer.state') setState(msg.payload);
      else if (msg.type === 'printer.event') pushEvent(msg.payload);
    });

    client.connect();
    client.subscribe(ids);

    return () => {
      off();
      client.close();
    };
  }, [wsUrl, detecting, ids, setState, pushEvent]);

  const sensors = useSensors(
    // Pointer só ativa após 8px de drag — evita disparar drag em cliques
    // normais (link pra detail page do card continua funcionando).
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setOrder((prev) => {
      const oldIdx = prev.findIndex((p) => p.id === active.id);
      const newIdx = prev.findIndex((p) => p.id === over.id);
      if (oldIdx === -1 || newIdx === -1) return prev;
      return arrayMove(prev, oldIdx, newIdx);
    });
  }

  async function saveOrder() {
    setSaving(true);
    const result = await reorderPrintersAction(order.map((p) => p.id));
    setSaving(false);
    if (result.ok) {
      toast.success('Ordem salva');
      setEditMode(false);
    } else {
      toast.error(result.error);
    }
  }

  function cancelEdit() {
    setOrder(printers);
    setEditMode(false);
  }

  if (printers.length === 0) {
    return (
      <div className="min-h-dvh flex items-center justify-center p-6">
        <div className="border border-dashed border-[var(--mc-accent-soft)]/40 p-12 text-center text-muted-foreground">
          <div className="text-heading uppercase tracking-wider">
            Nenhuma impressora cadastrada
          </div>
          <div className="text-small mt-2">
            Adicione impressoras no painel admin para vê-las aqui.
          </div>
        </div>
      </div>
    );
  }

  // Grade adapta às quantidades + breakpoints. Em monitor de parede
  // (≥1280px) chega a 3-4 colunas; em tablet portrait fica 1-2;
  // em phone, sempre 1 coluna.
  const cols = order.length;
  const gridClass =
    cols === 1
      ? 'grid-cols-1'
      : cols === 2
        ? 'grid-cols-1 md:grid-cols-2'
        : cols === 3
          ? 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3'
          : 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4';

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      <KioskStatusBanner printers={order} states={states} />

      {/* Barra de edição — toggle drag-and-drop reorder mode */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div data-mc-label className="text-caption text-muted-foreground uppercase tracking-wider">
          {editMode
            ? '// EDIT MODE · arraste os cards pra reordenar'
            : `// ${cols} impressora${cols === 1 ? '' : 's'} ativa${cols === 1 ? '' : 's'}`}
        </div>
        <div className="flex items-center gap-2">
          {editMode ? (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={cancelEdit}
                disabled={saving}
                className="uppercase tracking-wider"
              >
                Cancelar
              </Button>
              <Button
                size="sm"
                onClick={saveOrder}
                disabled={saving}
                className="uppercase tracking-wider"
              >
                <Check className="h-4 w-4 mr-1.5" />
                {saving ? 'Salvando…' : 'Salvar ordem'}
              </Button>
            </>
          ) : (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setEditMode(true)}
              className="uppercase tracking-wider"
            >
              <Pencil className="h-4 w-4 mr-1.5" />
              Reordenar
            </Button>
          )}
        </div>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={ids} strategy={rectSortingStrategy}>
          <div className={`grid gap-4 md:gap-6 ${gridClass}`}>
            {order.map((p) => (
              <SortablePrinterCard
                key={p.id}
                printerId={p.id}
                name={p.name}
                state={states[p.id]}
                editMode={editMode}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}

interface SortableCardProps {
  printerId: string;
  name: string;
  state: PrinterState | undefined;
  editMode: boolean;
}

function SortablePrinterCard({ printerId, name, state, editMode }: SortableCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: printerId, disabled: !editMode });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 10 : undefined,
  };

  return (
    <div ref={setNodeRef} style={style} className="relative">
      {editMode ? (
        // Em edit mode, sobrepõe um overlay com handle de drag que cobre
        // o card e intercepta cliques (impede navegação pro detail page).
        <div
          {...attributes}
          {...listeners}
          className="absolute inset-0 z-20 cursor-grab active:cursor-grabbing bg-primary/5 border-2 border-dashed border-primary/40 flex items-center justify-center"
          aria-label={`Arrastar ${name}`}
        >
          <div className="bg-card border border-[var(--mc-accent-soft)] px-4 py-2 flex items-center gap-2 text-primary">
            <GripVertical className="h-5 w-5" />
            <span data-mc-label className="text-caption uppercase tracking-wider">
              Arrastar
            </span>
          </div>
        </div>
      ) : null}
      <KioskPrinterCard printerId={printerId} name={name} state={state} />
    </div>
  );
}

