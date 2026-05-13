'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { useMemo, useState, type FormEvent } from 'react';
import { Check, X } from 'lucide-react';
import { SignupSchema, type SignupErrorCode, type SignupInput } from '@printstudio/shared';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { getApiBase } from '@/lib/bridge-url';
import { cn } from '@/lib/utils';

type FieldErrors = Partial<Record<keyof SignupInput, string>>;

interface SignupClientProps {
  inviteToken?: string;
  prefill?: {
    name: string;
    email: string;
  };
}

interface PasswordRule {
  label: string;
  test: (pwd: string) => boolean;
}

const PASSWORD_RULES: PasswordRule[] = [
  { label: 'Pelo menos 12 caracteres', test: (p) => p.length >= 12 },
  { label: 'Uma letra maiúscula', test: (p) => /[A-Z]/.test(p) },
  { label: 'Um número', test: (p) => /[0-9]/.test(p) },
  {
    label: 'Um caractere especial',
    test: (p) => /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?~`]/.test(p),
  },
];

/**
 * Form de signup (Story 8.1).
 *
 * Fluxo:
 * 1. Valida Zod client-side (SignupSchema do @printstudio/shared)
 * 2. POST /api/auth/signup → backend cria user + org + member (Story 8.2)
 * 3. Em sucesso: chama signIn('credentials') pra popular NextAuth JWT
 * 4. Redirect pra /onboarding/profile
 *
 * Pre-fill via invite token (Server Component) — Story 8.9.
 */
export function SignupClient({ inviteToken, prefill }: SignupClientProps) {
  const router = useRouter();
  const [name, setName] = useState(prefill?.name ?? '');
  const [email, setEmail] = useState(prefill?.email ?? '');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [emailExists, setEmailExists] = useState(false);

  const passwordChecks = useMemo(
    () => PASSWORD_RULES.map((r) => ({ ...r, ok: r.test(password) })),
    [password],
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    setErrors({});
    setServerError(null);
    setEmailExists(false);

    const form = event.currentTarget;
    const formData = new FormData(form);
    const honeypot = (formData.get('website') as string) || '';

    const payload: Record<string, unknown> = {
      name,
      email,
      password,
      confirmPassword,
      acceptTerms,
      website: honeypot || undefined,
    };
    if (inviteToken) payload.inviteToken = inviteToken;

    const parsed = SignupSchema.safeParse(payload);
    if (!parsed.success) {
      const fieldErrors: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] as keyof SignupInput | undefined;
        if (field && !fieldErrors[field]) {
          fieldErrors[field] = issue.message;
        }
      }
      setErrors(fieldErrors);
      return;
    }

    setSubmitting(true);

    try {
      const res = await fetch(`${getApiBase()}/api/auth/signup`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(parsed.data),
      });

      if (!res.ok) {
        const body = (await res
          .json()
          .catch(() => null)) as { error?: { code?: SignupErrorCode; message?: string } } | null;
        const code = body?.error?.code ?? 'INTERNAL_ERROR';
        if (code === 'EMAIL_EXISTS') {
          setEmailExists(true);
        } else {
          setServerError(
            body?.error?.message ?? 'Erro ao criar conta. Tente novamente.',
          );
        }
        return;
      }

      // Backend criou user OK. Agora popula sessão NextAuth pra
      // consistência com o app autenticado (login normal usa NextAuth).
      const signInRes = await signIn('credentials', {
        email: parsed.data.email,
        password: parsed.data.password,
        redirect: false,
      });

      if (!signInRes || signInRes.error) {
        setServerError(
          'Conta criada mas falha ao iniciar sessão. Tente fazer login.',
        );
        return;
      }

      router.push('/onboarding/profile');
      router.refresh();
    } catch {
      setServerError('Erro de conexão. Verifica sua internet e tenta de novo.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-dvh grid place-items-center p-4">
      <Card data-mc-card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <div
            data-mc-id
            className="text-caption uppercase tracking-widest text-primary"
          >
            {'// REGISTER · NEW-USER'}
          </div>
          <CardTitle className="text-heading uppercase tracking-wider">
            Criar conta
          </CardTitle>
          <CardDescription className="text-small">
            Comece a monitorar suas Bambu Lab A1 em minutos.
          </CardDescription>
          {prefill && (
            <p
              data-mc-id
              className="mt-2 inline-flex w-fit items-center gap-2 rounded-md border border-primary/40 bg-primary/10 px-2 py-1 text-caption uppercase tracking-wider text-primary"
            >
              <Check className="size-3" aria-hidden="true" />
              Convite confirmado
            </p>
          )}
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            {/* Honeypot — bots preenchem, humanos não */}
            <div
              aria-hidden="true"
              className="absolute -left-[9999px] size-0 overflow-hidden"
            >
              <label htmlFor="website">Não preencha</label>
              <input
                id="website"
                name="website"
                type="text"
                tabIndex={-1}
                autoComplete="off"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="name" data-mc-label className="uppercase tracking-wider text-caption">
                Nome
              </Label>
              <Input
                id="name"
                name="name"
                type="text"
                autoComplete="name"
                required
                minLength={2}
                maxLength={100}
                value={name}
                onChange={(e) => setName(e.target.value)}
                aria-required="true"
                aria-invalid={errors.name ? true : undefined}
              />
              {errors.name && (
                <p className="text-caption text-destructive" role="alert">
                  {errors.name}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="email" data-mc-label className="uppercase tracking-wider text-caption">
                Email
              </Label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                maxLength={200}
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setEmailExists(false);
                }}
                aria-required="true"
                aria-invalid={errors.email || emailExists ? true : undefined}
              />
              {errors.email && !emailExists && (
                <p className="text-caption text-destructive" role="alert">
                  {errors.email}
                </p>
              )}
              {emailExists && (
                <p className="text-caption text-destructive" role="alert">
                  Esse email já tem conta.{' '}
                  <Link href="/login" className="underline-offset-2 hover:underline">
                    Fazer login →
                  </Link>
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" data-mc-label className="uppercase tracking-wider text-caption">
                Senha
              </Label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                aria-required="true"
                aria-invalid={errors.password ? true : undefined}
              />
              <ul className="space-y-1 pt-1">
                {passwordChecks.map((rule) => (
                  <li
                    key={rule.label}
                    className={cn(
                      'flex items-center gap-2 text-caption',
                      rule.ok ? 'text-primary' : 'text-muted-foreground',
                    )}
                  >
                    {rule.ok ? (
                      <Check className="size-3" aria-hidden="true" />
                    ) : (
                      <X className="size-3" aria-hidden="true" />
                    )}
                    <span>{rule.label}</span>
                  </li>
                ))}
              </ul>
              {errors.password && (
                <p className="text-caption text-destructive" role="alert">
                  {errors.password}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label
                htmlFor="confirmPassword"
                data-mc-label
                className="uppercase tracking-wider text-caption"
              >
                Confirmar senha
              </Label>
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                aria-required="true"
                aria-invalid={errors.confirmPassword ? true : undefined}
              />
              {errors.confirmPassword && (
                <p className="text-caption text-destructive" role="alert">
                  {errors.confirmPassword}
                </p>
              )}
            </div>

            <div className="flex items-start gap-3 pt-1">
              <Checkbox
                id="acceptTerms"
                name="acceptTerms"
                checked={acceptTerms}
                onChange={(e) => setAcceptTerms(e.target.checked)}
                required
                aria-required="true"
                aria-invalid={errors.acceptTerms ? true : undefined}
                className="mt-0.5"
              />
              <Label
                htmlFor="acceptTerms"
                className="text-small font-normal leading-relaxed cursor-pointer"
              >
                Aceito os{' '}
                <a
                  href="https://guiaprint3d.com/termos-de-uso"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline-offset-2 hover:underline"
                >
                  termos de uso
                </a>{' '}
                e a{' '}
                <a
                  href="https://guiaprint3d.com/politica-de-privacidade"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline-offset-2 hover:underline"
                >
                  política de privacidade
                </a>
                .
              </Label>
            </div>
            {errors.acceptTerms && (
              <p className="text-caption text-destructive" role="alert">
                {errors.acceptTerms}
              </p>
            )}

            {serverError && (
              <div
                role="alert"
                className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-small text-destructive"
              >
                {serverError}
              </div>
            )}

            <Button
              type="submit"
              className="w-full uppercase tracking-wider h-11"
              disabled={submitting}
            >
              {submitting ? '[CRIANDO…]' : '[CRIAR CONTA]'}
            </Button>

            <p className="text-center text-caption text-muted-foreground">
              Já tem conta?{' '}
              <Link href="/login" className="text-primary underline-offset-2 hover:underline">
                Fazer login
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
