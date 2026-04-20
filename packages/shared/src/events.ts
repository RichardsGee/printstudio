import { z } from 'zod';

export const EventTypeSchema = z.enum([
  'PRINT_START',
  'PRINT_DONE',
  'PRINT_CANCELLED',
  'PRINT_FAILED',
  'ERROR',
  'FILAMENT_RUNOUT',
  'AMS_NEEDS_ATTENTION',
  'PRINTER_ONLINE',
  'PRINTER_OFFLINE',
]);
export type EventType = z.infer<typeof EventTypeSchema>;

export const EventSeveritySchema = z.enum(['INFO', 'WARN', 'ERROR']);
export type EventSeverity = z.infer<typeof EventSeveritySchema>;

export const PrinterEventSchema = z.object({
  id: z.string().optional(),
  printerId: z.string().uuid(),
  type: EventTypeSchema,
  severity: EventSeveritySchema,
  message: z.string(),
  payload: z.record(z.unknown()).optional(),
  createdAt: z.string().datetime(),
});
export type PrinterEvent = z.infer<typeof PrinterEventSchema>;
