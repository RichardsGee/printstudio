'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useState } from 'react';
import { z } from 'zod';
import {
  BR_STATES,
  WaitlistSubmitSchema,
  type WaitlistRole,
  type WaitlistBambuCountRange,
  type WaitlistErrorCode,
  type WaitlistSubmitInput,
} from '@printstudio/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useUtmParams, getReferrer } from '@/lib/utm';
import { trackEvent } from '@/lib/analytics';
import { cn } from '@/lib/utils';

const BAMBU_OPTIONS: { value: WaitlistBambuCountRange; label: string }[] = [
  { value: '1', label: '1' },
  { value: '2-3', label: '2–3' },
  { value: '4-10', label: '4–10' },
  { value: '11+', label: '11+' },
];

const ROLE_OPTIONS: { value: WaitlistRole; label: string }[] = [
  { value: 'hobbyist', label: 'Hobby pessoal' },
  { value: 'small_shop', label: 'Print shop (encomendas)' },
  { value: 'studio', label: 'Estúdio / agência' },
  { value: 'business', label: 'Empresa (fabricação)' },
  { value: 'other', label: 'Outro' },
];

const ERROR_MESSAGES: Record<WaitlistErrorCode, string> = {
  INVALID_PAYLOAD: 'Algum campo está inválido. Confira e tente novamente.',
  EMAIL_ALREADY_EXISTS: 'Esse email já está na lista — fica tranquilo!',
  RATE_LIMITED:
    'Muitas tentativas do mesmo IP. Espera 1 hora e tenta de novo.',
  INTERNAL_ERROR:
    'Algo deu errado do nosso lado. Tenta de novo em alguns minutos.',
};

type FieldErrors = Partial<Record<keyof WaitlistSubmitInput, string>>;

/**
 * Validação per-step (AC 15) — Zod leve só pros campos do step. O
 * contrato final/transforms continua sendo o WaitlistSubmitSchema no
 * submit (single source of truth do backend).
 */
const Step1Schema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Nome muito curto (mín. 2 caracteres)')
    .max(100, 'Nome muito longo'),
  email: z
    .string()
    .trim()
    .email('Email inválido')
    .max(200, 'Email muito longo'),
  acceptTerms: z.literal(true, {
    errorMap: () => ({ message: 'Você precisa aceitar os termos' }),
  }),
});

const Step2Schema = z.object({
  bambuCount: z.enum(['1', '2-3', '4-10', '11+'], {
    errorMap: () => ({ message: 'Selecione uma opção' }),
  }),
  role: z.enum(
    ['hobbyist', 'small_shop', 'studio', 'business', 'other'],
    { errorMap: () => ({ message: 'Selecione seu uso' }) },
  ),
});

interface WizardState {
  name: string;
  email: string;
  acceptTerms: boolean;
  bambuCount: WaitlistBambuCountRange;
  role: WaitlistRole | '';
  state: string;
  city: string;
  telegramHandle: string;
  phone: string;
  website: string; // honeypot
}

const INITIAL: WizardState = {
  name: '',
  email: '',
  acceptTerms: false,
  bambuCount: '1',
  role: '',
  state: '',
  city: '',
  telegramHandle: '',
  phone: '',
  website: '',
};

const TOTAL_STEPS = 3;

/**
 * Waitlist em wizard 3-step — Story 7.7 AC 13-19.
 *
 * - Estado controlado em memória (AC 18): nada de URL params, sem
 *   vazar PII no link compartilhável; refresh volta pro Step 1.
 * - Validação per-step Zod (AC 15) bloqueia avanço; submit final ainda
 *   passa pelo WaitlistSubmitSchema completo (contrato do backend).
 * - `waitlist_step_advance` (from_step/to_step) a cada avanço (AC 8/17);
 *   `waitlist_signup_success` é disparado pelo /sucesso no redirect.
 * - Honeypot `website` mora no Step 1 (AC 16).
 * - Step 3 tem "Pular e enviar" — completa sem os opcionais (AC 19).
 *
 * Mantém o nome do arquivo/export `WaitlistForm` e a `section#waitlist`
 * pra não quebrar imports nem as âncoras (sticky CTA, FAQ).
 */
export function WaitlistForm() {
  const router = useRouter();
  const utm = useUtmParams();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<WizardState>(INITIAL);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function set<K extends keyof WizardState>(key: K, value: WizardState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    if (errors[key as keyof FieldErrors]) {
      setErrors((e) => ({ ...e, [key]: undefined }));
    }
  }

  function applyZodErrors(issues: z.ZodIssue[]): FieldErrors {
    const fe: FieldErrors = {};
    for (const issue of issues) {
      const field = issue.path[0] as keyof WaitlistSubmitInput | undefined;
      if (field && !fe[field]) fe[field] = issue.message;
    }
    return fe;
  }

  function validateStep(target: number): boolean {
    if (target === 1) {
      const r = Step1Schema.safeParse({
        name: form.name,
        email: form.email,
        acceptTerms: form.acceptTerms,
      });
      if (!r.success) {
        setErrors(applyZodErrors(r.error.issues));
        return false;
      }
    }
    if (target === 2) {
      const r = Step2Schema.safeParse({
        bambuCount: form.bambuCount,
        role: form.role,
      });
      if (!r.success) {
        setErrors(applyZodErrors(r.error.issues));
        return false;
      }
    }
    return true;
  }

  function goNext() {
    setServerError(null);
    if (!validateStep(step)) return;
    const from = step;
    const to = step + 1;
    trackEvent('waitlist_step_advance', { from_step: from, to_step: to });
    setErrors({});
    setStep(to);
  }

  function goBack() {
    setServerError(null);
    setErrors({});
    setStep((s) => Math.max(1, s - 1));
  }

  async function submit(skipOptionals: boolean) {
    if (submitting) return;
    setServerError(null);
    setErrors({});

    // Step 1 e 2 já foram validados pra chegar no 3, mas revalida por
    // segurança (ex: refresh manual de estado).
    if (!validateStep(1)) {
      setStep(1);
      return;
    }
    if (!validateStep(2)) {
      setStep(2);
      return;
    }

    const payload: Record<string, unknown> = {
      name: form.name,
      email: form.email,
      bambuCount: form.bambuCount,
      role: form.role || 'other',
      acceptTerms: form.acceptTerms,
      website: form.website || undefined,
    };
    if (!skipOptionals) {
      if (form.state) payload.state = form.state;
      if (form.city) payload.city = form.city;
      if (form.telegramHandle) payload.telegramHandle = form.telegramHandle;
      if (form.phone) payload.phone = form.phone;
    }
    if (utm) payload.utm = utm;
    const referrer = getReferrer();
    if (referrer) payload.referrer = referrer;

    const parsed = WaitlistSubmitSchema.safeParse(payload);
    if (!parsed.success) {
      const fe = applyZodErrors(parsed.error.issues);
      setErrors(fe);
      // Pula pro step que contém o primeiro erro pra UX não travar.
      if (fe.name || fe.email || fe.acceptTerms) setStep(1);
      else if (fe.bambuCount || fe.role) setStep(2);
      return;
    }

    setSubmitting(true);
    // AC 17 — marca o "advance" final (step 3 → submit) pra fechar o funil.
    trackEvent('waitlist_step_advance', {
      from_step: TOTAL_STEPS,
      to_step: 'submit',
    });
    try {
      // AC 5 — path relativo: same-origin via proxy route do apps/web.
      const res = await fetch('/api/public/waitlist', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(parsed.data),
      });
      if (res.ok) {
        router.push('/sucesso'); // success-page-client dispara o success
        return;
      }
      const body = (await res
        .json()
        .catch(() => null)) as { error?: { code?: WaitlistErrorCode } } | null;
      const code = body?.error?.code ?? 'INTERNAL_ERROR';
      setServerError(ERROR_MESSAGES[code] ?? ERROR_MESSAGES.INTERNAL_ERROR);
    } catch {
      setServerError('Erro de conexão. Verifica sua internet e tenta de novo.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section
      id="waitlist"
      className="container max-w-3xl py-16 sm:py-20"
      aria-labelledby="waitlist-title"
    >
      <div className="space-y-3 text-center">
        <p
          data-mc-id
          className="text-caption font-mono uppercase tracking-wider text-primary"
        >
          {'// REGISTER · WAITLIST'}
        </p>
        <h2 id="waitlist-title" className="text-3xl font-semibold sm:text-4xl">
          Entrar na lista de espera
        </h2>
        <p className="text-body text-muted-foreground">
          Três passos rápidos — priorizamos quem opera frota maior e tem
          dor de monitorar à distância.
        </p>
      </div>

      <div
        className="mt-10 rounded-lg border border-[var(--mc-accent-soft)]/30 bg-card/40 p-6 sm:p-8"
        data-mc-card
      >
        <StepProgress current={step} />

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (step < TOTAL_STEPS) goNext();
            else submit(false);
          }}
          noValidate
          className="mt-8 space-y-5"
        >
          {step === 1 && (
            <>
              {/* Honeypot — AC 16 (invisível pra humanos) */}
              <div
                aria-hidden="true"
                className="absolute -left-[9999px] size-0 overflow-hidden"
              >
                <label htmlFor="website">Não preencha este campo</label>
                <input
                  id="website"
                  name="website"
                  type="text"
                  tabIndex={-1}
                  autoComplete="off"
                  value={form.website}
                  onChange={(e) => set('website', e.target.value)}
                />
              </div>

              <FormField label="Nome" name="name" required error={errors.name}>
                <Input
                  id="name"
                  type="text"
                  autoComplete="name"
                  value={form.name}
                  onChange={(e) => set('name', e.target.value)}
                  aria-required="true"
                  aria-invalid={errors.name ? true : undefined}
                />
              </FormField>

              <FormField
                label="Email"
                name="email"
                required
                error={errors.email}
              >
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={form.email}
                  onChange={(e) => set('email', e.target.value)}
                  aria-required="true"
                  aria-invalid={errors.email ? true : undefined}
                />
              </FormField>

              <div className="flex items-start gap-3 pt-2">
                <Checkbox
                  id="acceptTerms"
                  checked={form.acceptTerms}
                  onChange={(e) => set('acceptTerms', e.target.checked)}
                  aria-required="true"
                  aria-invalid={errors.acceptTerms ? true : undefined}
                  className="mt-0.5"
                />
                <Label
                  htmlFor="acceptTerms"
                  className="cursor-pointer text-small font-normal leading-relaxed"
                >
                  Aceito os{' '}
                  <Link
                    href="/termos-de-uso"
                    className="text-primary underline-offset-2 hover:underline"
                  >
                    termos de uso
                  </Link>{' '}
                  e a{' '}
                  <Link
                    href="/politica-de-privacidade"
                    className="text-primary underline-offset-2 hover:underline"
                  >
                    política de privacidade
                  </Link>
                  .
                </Label>
              </div>
              {errors.acceptTerms && (
                <p className="text-caption text-destructive" role="alert">
                  {errors.acceptTerms}
                </p>
              )}
            </>
          )}

          {step === 2 && (
            <>
              <fieldset
                aria-required="true"
                aria-invalid={errors.bambuCount ? true : undefined}
              >
                <legend className="mb-2 text-small font-medium">
                  Quantas Bambu Lab você opera?{' '}
                  <span className="text-destructive" aria-hidden="true">
                    *
                  </span>
                </legend>
                <RadioGroup
                  name="bambuCount"
                  value={form.bambuCount}
                  onValueChange={(v) =>
                    set('bambuCount', v as WaitlistBambuCountRange)
                  }
                  className="grid grid-cols-2 gap-2 sm:grid-cols-4"
                  aria-label="Quantidade de Bambu"
                >
                  {BAMBU_OPTIONS.map((opt) => (
                    <RadioGroupItem
                      key={opt.value}
                      value={opt.value}
                      label={opt.label}
                    />
                  ))}
                </RadioGroup>
                {errors.bambuCount && (
                  <p
                    className="mt-2 text-caption text-destructive"
                    role="alert"
                  >
                    {errors.bambuCount}
                  </p>
                )}
              </fieldset>

              <FormField
                label="Qual seu uso?"
                name="role"
                required
                error={errors.role}
              >
                <Select
                  id="role"
                  value={form.role}
                  onChange={(e) =>
                    set('role', e.target.value as WaitlistRole)
                  }
                  aria-required="true"
                  aria-invalid={errors.role ? true : undefined}
                >
                  <option value="" disabled>
                    Selecione…
                  </option>
                  {ROLE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </Select>
              </FormField>
            </>
          )}

          {step === 3 && (
            <>
              <p className="text-small text-muted-foreground">
                Opcional — ajuda a gente a priorizar e a falar com você.
                Pode pular.
              </p>
              <div className="grid gap-5 sm:grid-cols-2">
                <FormField
                  label="Estado"
                  name="state"
                  hint="Opcional"
                  error={errors.state}
                >
                  <Select
                    id="state"
                    value={form.state}
                    onChange={(e) => set('state', e.target.value)}
                    aria-invalid={errors.state ? true : undefined}
                  >
                    <option value="">Selecione…</option>
                    {BR_STATES.map((uf) => (
                      <option key={uf} value={uf}>
                        {uf}
                      </option>
                    ))}
                  </Select>
                </FormField>

                <FormField
                  label="Cidade"
                  name="city"
                  hint="Opcional"
                  error={errors.city}
                >
                  <Input
                    id="city"
                    type="text"
                    autoComplete="address-level2"
                    value={form.city}
                    onChange={(e) => set('city', e.target.value)}
                    aria-invalid={errors.city ? true : undefined}
                  />
                </FormField>
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <FormField
                  label="Telegram @"
                  name="telegramHandle"
                  hint="Opcional"
                  error={errors.telegramHandle}
                >
                  <Input
                    id="telegramHandle"
                    type="text"
                    placeholder="@usuario"
                    value={form.telegramHandle}
                    onChange={(e) => set('telegramHandle', e.target.value)}
                    aria-invalid={errors.telegramHandle ? true : undefined}
                  />
                </FormField>

                <FormField
                  label="WhatsApp"
                  name="phone"
                  hint="Opcional"
                  error={errors.phone}
                >
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="(11) 99999-9999"
                    autoComplete="tel"
                    value={form.phone}
                    onChange={(e) => set('phone', e.target.value)}
                    aria-invalid={errors.phone ? true : undefined}
                  />
                </FormField>
              </div>
            </>
          )}

          {serverError && (
            <div
              role="alert"
              className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-small text-destructive"
            >
              {serverError}
            </div>
          )}

          <div className="flex flex-col gap-3 pt-2 sm:flex-row-reverse">
            {step < TOTAL_STEPS ? (
              <Button type="submit" size="lg" className="sm:flex-1 text-base">
                Continuar
              </Button>
            ) : (
              <Button
                type="submit"
                size="lg"
                disabled={submitting}
                className="sm:flex-1 text-base"
              >
                {submitting ? 'Enviando…' : 'Solicitar acesso'}
              </Button>
            )}

            {step > 1 && (
              <Button
                type="button"
                size="lg"
                variant="outline"
                onClick={goBack}
                disabled={submitting}
              >
                Voltar
              </Button>
            )}
          </div>

          {step === TOTAL_STEPS && (
            <button
              type="button"
              onClick={() => submit(true)}
              disabled={submitting}
              className="mx-auto block text-caption text-muted-foreground underline-offset-2 hover:text-foreground hover:underline disabled:opacity-50"
            >
              Pular e enviar sem os opcionais
            </button>
          )}

          <p className="text-center text-caption text-muted-foreground">
            Sem spam · Você sai da lista a qualquer momento
          </p>
        </form>
      </div>
    </section>
  );
}

/**
 * Indicador de progresso — AC 14: `[●─○─○] Passo 1 de 3`.
 */
function StepProgress({ current }: { current: number }) {
  return (
    <div className="space-y-2">
      <div
        className="flex items-center gap-2"
        aria-hidden="true"
      >
        {Array.from({ length: TOTAL_STEPS }).map((_, i) => {
          const n = i + 1;
          const done = n <= current;
          return (
            <div key={n} className="flex flex-1 items-center gap-2">
              <span
                className={cn(
                  'inline-flex size-6 shrink-0 items-center justify-center rounded-full border text-caption font-mono transition-colors',
                  done
                    ? 'border-primary bg-primary/15 text-primary'
                    : 'border-input text-muted-foreground',
                )}
              >
                {n}
              </span>
              {n < TOTAL_STEPS && (
                <span
                  className={cn(
                    'h-px flex-1 transition-colors',
                    n < current ? 'bg-primary' : 'bg-input',
                  )}
                />
              )}
            </div>
          );
        })}
      </div>
      <p className="text-caption font-mono uppercase tracking-wider text-muted-foreground">
        {`Passo ${current} de ${TOTAL_STEPS}`}
      </p>
    </div>
  );
}

interface FormFieldProps {
  label: string;
  name: string;
  children: React.ReactNode;
  required?: boolean;
  error?: string;
  hint?: string;
}

function FormField({
  label,
  name,
  children,
  required,
  error,
  hint,
}: FormFieldProps) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between">
        <Label
          htmlFor={name}
          className={cn(
            'text-small',
            required && 'after:ml-1 after:text-destructive after:content-["*"]',
          )}
        >
          {label}
        </Label>
        {hint && !error && (
          <span className="text-caption text-muted-foreground">{hint}</span>
        )}
      </div>
      {children}
      {error && (
        <p
          id={`${name}-error`}
          className="text-caption text-destructive"
          role="alert"
        >
          {error}
        </p>
      )}
    </div>
  );
}
