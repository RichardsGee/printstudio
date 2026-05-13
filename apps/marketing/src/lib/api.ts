/**
 * URL base da API pública.
 *
 * Em dev: `NEXT_PUBLIC_API_URL` ou fallback `http://localhost:4000`.
 * Em prod (static export): obrigatório definir `NEXT_PUBLIC_API_URL`
 * apontando pra `https://api.guiaprint3d.com` (ou equivalente).
 */
export function getApiBase(): string {
  const override = process.env.NEXT_PUBLIC_API_URL;
  if (override) return override.replace(/\/$/, '');
  return 'http://localhost:4000';
}
