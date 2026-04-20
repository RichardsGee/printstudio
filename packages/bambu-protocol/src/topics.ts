/**
 * Bambu Lab MQTT topics.
 *
 * Reference: https://github.com/Doridian/OpenBambuAPI/blob/main/mqtt.md
 *
 * Subscription pattern from the printer:
 *   - device/{serial}/report   → printer publishes state updates (JSON)
 *
 * Publishing pattern to the printer:
 *   - device/{serial}/request  → bridge publishes commands
 */

export function reportTopic(serial: string): string {
  return `device/${serial}/report`;
}

export function requestTopic(serial: string): string {
  return `device/${serial}/request`;
}

export function deviceTopicPattern(serial: string): string {
  return `device/${serial}/#`;
}
