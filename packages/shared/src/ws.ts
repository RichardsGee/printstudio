import { z } from 'zod';
import { PrinterStateSchema } from './printer.js';
import { PrinterEventSchema } from './events.js';

export const CommandActionSchema = z.enum(['pause', 'resume', 'stop']);
export type CommandAction = z.infer<typeof CommandActionSchema>;

export const ClientInboundMessageSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('printer.state'),
    payload: PrinterStateSchema,
  }),
  z.object({
    type: z.literal('printer.event'),
    payload: PrinterEventSchema,
  }),
  z.object({
    type: z.literal('error'),
    payload: z.object({ message: z.string(), code: z.string().optional() }),
  }),
  z.object({
    type: z.literal('pong'),
    payload: z.object({ ts: z.number() }),
  }),
]);
export type ClientInboundMessage = z.infer<typeof ClientInboundMessageSchema>;

export const ClientOutboundMessageSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('subscribe'),
    payload: z.object({ printerIds: z.array(z.string().uuid()) }),
  }),
  z.object({
    type: z.literal('command'),
    payload: z.object({
      printerId: z.string().uuid(),
      action: CommandActionSchema,
    }),
  }),
  z.object({
    type: z.literal('ping'),
    payload: z.object({ ts: z.number() }),
  }),
]);
export type ClientOutboundMessage = z.infer<typeof ClientOutboundMessageSchema>;

export const BridgeMessageSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('bridge.hello'),
    payload: z.object({ token: z.string(), bridgeId: z.string() }),
  }),
  z.object({
    type: z.literal('bridge.state'),
    payload: PrinterStateSchema,
  }),
  z.object({
    type: z.literal('bridge.event'),
    payload: PrinterEventSchema,
  }),
  z.object({
    type: z.literal('bridge.command.ack'),
    payload: z.object({
      commandId: z.string(),
      success: z.boolean(),
      error: z.string().optional(),
    }),
  }),
]);
export type BridgeMessage = z.infer<typeof BridgeMessageSchema>;
