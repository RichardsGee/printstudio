/**
 * URL base da API pra server-side fetches (Server Components).
 *
 * Em dev (Next dev server): usa `NEXT_PUBLIC_API_URL` ou fallback
 * `http://localhost:4000`.
 *
 * Em prod: precisa `NEXT_PUBLIC_API_URL` apontando pra `https://api.guiaprint3d.com`.
 */
export function getApiBaseServer(): string {
  const override = process.env.NEXT_PUBLIC_API_URL ?? process.env.API_URL;
  if (override) return override.replace(/\/$/, '');
  return 'http://localhost:4000';
}
