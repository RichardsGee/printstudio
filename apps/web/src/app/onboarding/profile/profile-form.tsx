'use client';

import { useState, useTransition, type FormEvent } from 'react';
import { Check } from 'lucide-react';
import {
  BR_STATES,
  OrgProfileSchema,
  type BrazilState,
  type OrgProfileInput,
  type WaitlistRole,
} from '@printstudio/shared';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { WizardProgress } from '../_components/wizard-progress';
import { updateOrgProfile } from './actions';

const ROLE_OPTIONS: { value: WaitlistRole; label: string }[] = [
  { value: 'hobbyist', label: 'Hobby pessoal' },
  { value: 'small_shop', label: 'Print shop (encomendas)' },
  { value: 'studio', label: 'Estúdio / agência' },
  { value: 'business', label: 'Empresa (fabricação)' },
  { value: 'other', label: 'Outro' },
];

type FieldErrors = Partial<Record<keyof OrgProfileInput, string>>;

interface ProfileFormProps {
  prefill: {
    orgName: string;
    state?: BrazilState;
    city?: string;
    role?: WaitlistRole;
  };
  fromInvite: boolean;
}

/**
 * Step 1 — Form de perfil. Server action `updateOrgProfile` valida
 * server-side, atualiza org e redireciona pra `/onboarding/bambu-connect`.
 *
 * Validação Zod client-side acontece antes de chamar action pra UX
 * mais rápida; action revalida pra garantir segurança.
 */
export function ProfileForm({ prefill, fromInvite }: ProfileFormProps) {
  const [orgName, setOrgName] = useState(prefill.orgName);
  const [state, setState] = useState<string>(prefill.state ?? '');
  const [city, setCity] = useState(prefill.city ?? '');
  const [role, setRole] = useState<string>(prefill.role ?? '');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrors({});
    setServerError(null);

    const payload = {
      orgName,
      state,
      city: city || undefined,
      role,
    };

    const parsed = OrgProfileSchema.safeParse(payload);
    if (!parsed.success) {
      const fieldErrors: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] as keyof OrgProfileInput | undefined;
        if (field && !fieldErrors[field]) {
          fieldErrors[field] = issue.message;
        }
      }
      setErrors(fieldErrors);
      return;
    }

    startTransition(async () => {
      const result = await updateOrgProfile(parsed.data);
      if (result && !result.ok && result.error) {
        const field = result.error.field as keyof OrgProfileInput | undefined;
        if (field) {
          setErrors({ [field]: result.error.message });
        } else {
          setServerError(result.error.message);
        }
      }
      // Em sucesso, action chama redirect() e essa branch não retorna.
    });
  }

  return (
    <div className="container max-w-2xl space-y-6">
      <WizardProgress current="profile" />

      <Card data-mc-card>
        <CardHeader className="space-y-2">
          <div
            data-mc-id
            className="text-caption font-mono uppercase tracking-widest text-primary"
          >
            {'// STEP-01/03 · PROFILE'}
          </div>
          <CardTitle className="text-2xl">Conta a gente um pouco</CardTitle>
          <CardDescription>
            Vamos personalizar sua experiência com base no seu uso.
          </CardDescription>
          {fromInvite && (
            <p
              data-mc-id
              className="mt-2 inline-flex w-fit items-center gap-2 rounded-md border border-primary/40 bg-primary/10 px-2 py-1 text-caption uppercase tracking-wider text-primary"
            >
              <Check className="size-3" aria-hidden="true" />
              Dados pré-carregados do convite
            </p>
          )}
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} noValidate className="space-y-5">
            <div className="space-y-1.5">
              <Label
                htmlFor="orgName"
                data-mc-label
                className="uppercase tracking-wider text-caption"
              >
                Nome da organização *
              </Label>
              <Input
                id="orgName"
                name="orgName"
                type="text"
                required
                minLength={2}
                maxLength={100}
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                aria-required="true"
                aria-invalid={errors.orgName ? true : undefined}
              />
              {errors.orgName && (
                <p className="text-caption text-destructive" role="alert">
                  {errors.orgName}
                </p>
              )}
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label
                  htmlFor="state"
                  data-mc-label
                  className="uppercase tracking-wider text-caption"
                >
                  Estado *
                </Label>
                <Select
                  id="state"
                  name="state"
                  required
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  aria-required="true"
                  aria-invalid={errors.state ? true : undefined}
                >
                  <option value="" disabled>
                    Selecione…
                  </option>
                  {BR_STATES.map((uf) => (
                    <option key={uf} value={uf}>
                      {uf}
                    </option>
                  ))}
                </Select>
                {errors.state && (
                  <p className="text-caption text-destructive" role="alert">
                    {errors.state}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label
                  htmlFor="city"
                  data-mc-label
                  className="uppercase tracking-wider text-caption"
                >
                  Cidade
                </Label>
                <Input
                  id="city"
                  name="city"
                  type="text"
                  maxLength={100}
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  aria-invalid={errors.city ? true : undefined}
                />
                {errors.city && (
                  <p className="text-caption text-destructive" role="alert">
                    {errors.city}
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label
                htmlFor="role"
                data-mc-label
                className="uppercase tracking-wider text-caption"
              >
                Qual seu uso? *
              </Label>
              <Select
                id="role"
                name="role"
                required
                value={role}
                onChange={(e) => setRole(e.target.value)}
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
              {errors.role && (
                <p className="text-caption text-destructive" role="alert">
                  {errors.role}
                </p>
              )}
            </div>

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
              disabled={pending}
            >
              {pending ? '[SALVANDO…]' : '[PRÓXIMO]'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
