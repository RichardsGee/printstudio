/**
 * Command builders for Bambu printers.
 *
 * Commands are published as JSON to `device/{serial}/request`.
 * Each command has a `sequence_id` (arbitrary identifier used by the printer
 * to correlate responses) and a command-specific payload.
 *
 * Reference: https://github.com/Doridian/OpenBambuAPI/blob/main/mqtt.md
 */

import type { CommandAction } from '@printstudio/shared';

let sequenceCounter = 0;
function nextSequenceId(): string {
  sequenceCounter = (sequenceCounter + 1) % 1_000_000;
  return String(sequenceCounter);
}

export interface BambuCommand {
  [key: string]: unknown;
}

export function buildPauseCommand(): BambuCommand {
  return {
    print: {
      sequence_id: nextSequenceId(),
      command: 'pause',
    },
  };
}

export function buildResumeCommand(): BambuCommand {
  return {
    print: {
      sequence_id: nextSequenceId(),
      command: 'resume',
    },
  };
}

export function buildStopCommand(): BambuCommand {
  return {
    print: {
      sequence_id: nextSequenceId(),
      command: 'stop',
    },
  };
}

export function buildPushAllCommand(): BambuCommand {
  return {
    pushing: {
      sequence_id: nextSequenceId(),
      command: 'pushall',
    },
  };
}

export function buildCommandForAction(action: CommandAction): BambuCommand {
  switch (action) {
    case 'pause':
      return buildPauseCommand();
    case 'resume':
      return buildResumeCommand();
    case 'stop':
      return buildStopCommand();
  }
}
