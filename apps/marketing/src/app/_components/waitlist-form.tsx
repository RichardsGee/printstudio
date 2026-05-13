'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useState, type FormEvent } from 'react';
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
import { getApiBase } from '@/lib/api';
import { useUtmParams, getReferrer } from '@/lib/utm';
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
  INTERNAL_ERROR: 'Algo deu errado do nosso lado. Tenta de novo em alguns minutos.',
};

type FieldErrors = Partial<Record<keyof WaitlistSubmitInput, string>>;

/**
 * Form de waitlist rico (9 campos + honeypot + checkbox terms).
 * Validação Zod client-side + envio pro endpoint POST /api/public/waitlist.
 * Em caso de sucesso: redireciona pra /sucesso (Story 7.5).
 */
export function WaitlistForm() {
  const router = useRouter();
  const utm = useUtmParams();
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    setErrors({});
    setServerError(null);

    const form = event.currentTarget;
    const formData = new FormData(form);

    const rawState = (formData.get('state') as string) || '';
    const rawCity = (formData.get('city') as string) || '';
    const rawTelegram = (formData.get('telegramHandle') as string) || '';
    const rawPhone = (formData.get('phone') as string) || '';

    const payload: Record<string, unknown> = {
      name: (formData.get('name') as string) || '',
      email: (formData.get('email') as string) || '',
      bambuCount: (formData.get('bambuCount') as string) || '',
      role: (formData.get('role') as string) || 'other',
      acceptTerms: formData.get('acceptTerms') === 'on',
      website: (formData.get('website') as string) || undefined,
    };
    if (rawState) payload.state = rawState;
    if (rawCity) payload.city = rawCity;
    if (rawTelegram) payload.telegramHandle = rawTelegram;
    if (rawPhone) payload.phone = rawPhone;
    if (utm) payload.utm = utm;
    const referrer = getReferrer();
    if (referrer) payload.referrer = referrer;

    const parsed = WaitlistSubmitSchema.safeParse(payload);
    if (!parsed.success) {
      const fieldErrors: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] as keyof WaitlistSubmitInput | undefined;
        if (field && !fieldErrors[field]) {
          fieldErrors[field] = issue.message;
        }
      }
      setErrors(fieldErrors);
      return;
    }

    setSubmitting(true);

    try {
      const res = await fetch(`${getApiBase()}/api/public/waitlist`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(parsed.data),
      });

      if (res.ok) {
        router.push('/sucesso');
        return;
      }

      const body = (await res
        .json()
        .catch(() => null)) as { error?: { code?: WaitlistErrorCode } } | null;
      const code = body?.error?.code ?? 'INTERNAL_ERROR';
      setServerError(ERROR_MESSAGES[code] ?? ERROR_MESSAGES.INTERNAL_ERROR);
    } catch {
      setServerError(
        'Erro de conexão. Verifica sua internet e tenta de novo.',
      );
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
          Conta um pouco sobre seu uso — priorizamos quem opera frota maior
          e tem dor de monitorar à distância.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        noValidate
        className="mt-10 space-y-5 rounded-lg border border-[var(--mc-accent-soft)]/30 bg-card/40 p-6 sm:p-8"
        data-mc-card
      >
        {/* Honeypot — invisible pra humanos, visível pra bots */}
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
          />
        </div>

        <FormField
          label="Nome"
          name="name"
          required
          error={errors.name}
          input={
            <Input
              id="name"
              name="name"
              type="text"
              autoComplete="name"
              required
              minLength={2}
              maxLength={100}
              aria-required="true"
              aria-invalid={errors.name ? true : undefined}
            />
          }
        />

        <FormField
          label="Email"
          name="email"
          required
          error={errors.email}
          input={
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              maxLength={200}
              aria-required="true"
              aria-invalid={errors.email ? true : undefined}
            />
          }
        />

        <div className="grid gap-5 sm:grid-cols-2">
          <FormField
            label="Estado"
            name="state"
            error={errors.state}
            hint="Opcional"
            input={
              <Select
                id="state"
                name="state"
                defaultValue=""
                aria-invalid={errors.state ? true : undefined}
              >
                <option value="">Selecione…</option>
                {BR_STATES.map((uf) => (
                  <option key={uf} value={uf}>
                    {uf}
                  </option>
                ))}
              </Select>
            }
          />

          <FormField
            label="Cidade"
            name="city"
            error={errors.city}
            hint="Opcional"
            input={
              <Input
                id="city"
                name="city"
                type="text"
                autoComplete="address-level2"
                maxLength={100}
                aria-invalid={errors.city ? true : undefined}
              />
            }
          />
        </div>

        <FormField
          label="Qual seu uso?"
          name="role"
          required
          error={errors.role}
          input={
            <Select
              id="role"
              name="role"
              required
              defaultValue=""
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
          }
        />

        <fieldset
          aria-required="true"
          aria-invalid={errors.bambuCount ? true : undefined}
          aria-describedby={errors.bambuCount ? 'bambuCount-error' : undefined}
        >
          <legend className="mb-2 text-small font-medium">
            Quantas Bambu Lab você opera?{' '}
            <span className="text-destructive" aria-hidden="true">
              *
            </span>
          </legend>
          <RadioGroup
            name="bambuCount"
            defaultValue="1"
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
              id="bambuCount-error"
              className="mt-2 text-caption text-destructive"
              role="alert"
            >
              {errors.bambuCount}
            </p>
          )}
        </fieldset>

        <div className="grid gap-5 sm:grid-cols-2">
          <FormField
            label="Telegram @"
            name="telegramHandle"
            error={errors.telegramHandle}
            hint="Opcional"
            input={
              <Input
                id="telegramHandle"
                name="telegramHandle"
                type="text"
                placeholder="@usuario"
                maxLength={50}
                aria-invalid={errors.telegramHandle ? true : undefined}
              />
            }
          />

          <FormField
            label="WhatsApp"
            name="phone"
            error={errors.phone}
            hint="Opcional"
            input={
              <Input
                id="phone"
                name="phone"
                type="tel"
                placeholder="(11) 99999-9999"
                autoComplete="tel"
                maxLength={20}
                aria-invalid={errors.phone ? true : undefined}
              />
            }
          />
        </div>

        <div className="flex items-start gap-3 pt-2">
          <Checkbox
            id="acceptTerms"
            name="acceptTerms"
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
          size="lg"
          disabled={submitting}
          className="w-full text-base"
        >
          {submitting ? 'Enviando…' : 'Solicitar acesso'}
        </Button>

        <p className="text-center text-caption text-muted-foreground">
          Sem spam · Você sai da lista a qualquer momento
        </p>
      </form>
    </section>
  );
}

interface FormFieldProps {
  label: string;
  name: string;
  input: React.ReactNode;
  required?: boolean;
  error?: string;
  hint?: string;
}

function FormField({ label, name, input, required, error, hint }: FormFieldProps) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between">
        <Label
          htmlFor={name}
          className={cn('text-small', required && 'after:ml-1 after:text-destructive after:content-["*"]')}
        >
          {label}
        </Label>
        {hint && !error && (
          <span className="text-caption text-muted-foreground">{hint}</span>
        )}
      </div>
      {input}
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
