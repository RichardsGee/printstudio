'use client';

import { create } from 'zustand';
import type { PrinterState, PrinterEvent } from '@printstudio/shared';

interface PrinterStore {
  states: Record<string, PrinterState>;
  recentEvents: PrinterEvent[];
  setState: (state: PrinterState) => void;
  pushEvent: (event: PrinterEvent) => void;
  clear: () => void;
}

const MAX_RECENT_EVENTS = 100;

export const usePrinterStore = create<PrinterStore>((set) => ({
  states: {},
  recentEvents: [],
  setState: (state) =>
    set((s) => ({
      states: { ...s.states, [state.printerId]: state },
    })),
  pushEvent: (event) =>
    set((s) => ({
      recentEvents: [event, ...s.recentEvents].slice(0, MAX_RECENT_EVENTS),
    })),
  clear: () => set({ states: {}, recentEvents: [] }),
}));
