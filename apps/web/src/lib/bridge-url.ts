/**
 * URL base do bridge LAN (porta 8080 por padrão). Em vez de hardcodar
 * `localhost`, usa o hostname do browser — assim funciona quando você
 * acessa o kiosk de outro device da rede (tablet, monitor, celular).
 *
 * Exemplos:
 *   - Browser em http://localhost:3000        → bridge em http://localhost:8080
 *   - Browser em http://10.0.0.98:3000        → bridge em http://10.0.0.98:8080
 *   - Browser em http://printstudio.local:3000 → bridge em http://printstudio.local:8080
 *
 * Override opcional via NEXT_PUBLIC_LAN_DISCOVERY_HOST/PORT pra casos
 * onde o bridge roda numa máquina diferente do servidor web.
 */
export function getBridgeBase(): string {
  const port = process.env.NEXT_PUBLIC_LAN_DISCOVERY_PORT ?? '8080';
  const overrideHost = process.env.NEXT_PUBLIC_LAN_DISCOVERY_HOST;
  if (overrideHost && overrideHost !== 'localhost') {
    return `http://${overrideHost}:${port}`;
  }
  if (typeof window !== 'undefined' && window.location.hostname) {
    return `http://${window.location.hostname}:${port}`;
  }
  return `http://localhost:${port}`;
}
