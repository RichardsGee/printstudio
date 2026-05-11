'use client';

import { useEffect, useState, useTransition } from 'react';
import { toast } from 'sonner';
import type {
  BambuConnectionStatus,
  BambuDevice,
  BambuErrorCode,
  BambuVerifyCodeResponse,
} from '@printstudio/shared';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/ui/page-header';

type Step = 'loading' | 'connected' | 'email' | 'code' | 'success';

interface ErrorBody {
  error: { code: BambuErrorCode; message: string };
}

const ERROR_MESSAGES: Record<BambuErrorCode, string> = {
  BAMBU_VERIFY_REQUIRED: 'A Bambu pediu nova verificação. Tente enviar o código de novo.',
  BAMBU_TFA_REQUIRED:
    'Sua conta Bambu exige 2FA — não é suportado nesta versão. Desative o 2FA no portal Bambu Lab pra continuar.',
  BAMBU_INVALID_CODE: 'Código inválido ou expirado. Peça um novo código e tente de novo.',
  BAMBU_RATE_LIMITED: 'Muitas tentativas. Espera ~1 minuto e tenta de novo.',
  BAMBU_UPSTREAM_ERROR: 'A Bambu Cloud retornou um erro inesperado. Tente de novo em alguns segundos.',
  INTERNAL_ERROR: 'Erro interno. Verifique os logs.',
};

async function parseError(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as ErrorBody;
    if (body.error?.code) {
      return ERROR_MESSAGES[body.error.code] ?? body.error.message;
    }
  } catch {
    /* fall through */
  }
  return `Erro ${res.status}`;
}

export default function BambuConnectPage() {
  const [step, setStep] = useState<Step>('loading');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [devices, setDevices] = useState<BambuDevice[]>([]);
  const [status, setStatus] = useState<BambuConnectionStatus | null>(null);
  const [pending, start] = useTransition();

  // Carrega status atual ao montar (se já tem conta conectada, mostra direto)
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/bambu/status`, { credentials: 'include' })
      .then((res) => (res.ok ? (res.json() as Promise<BambuConnectionStatus>) : null))
      .then((data) => {
        if (cancelled) return;
        setStatus(data);
        setStep(data?.connected ? 'connected' : 'email');
      })
      .catch(() => {
        if (!cancelled) setStep('email');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function reset() {
    setStep('email');
    setEmail('');
    setCode('');
    setDevices([]);
  }

  function disconnect() {
    if (!confirm('Remover a conta Bambu Cloud vinculada? O worker para de receber telemetria.')) return;
    start(async () => {
      const res = await fetch(`/api/bambu/connection`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) {
        toast.error('Falhou ao desconectar');
        return;
      }
      toast.success('Conta Bambu desconectada');
      setStatus({ connected: false });
      reset();
    });
  }

  function sendCode(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed.includes('@')) {
      toast.error('Email inválido');
      return;
    }
    start(async () => {
      const res = await fetch(`/api/bambu/send-code`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmed }),
      });
      if (!res.ok) {
        toast.error(await parseError(res));
        return;
      }
      toast.success(`Código enviado pra ${trimmed}`);
      setStep('code');
    });
  }

  function verifyCode(e: React.FormEvent) {
    e.preventDefault();
    const cleanCode = code.replace(/\D/g, '');
    if (cleanCode.length !== 6) {
      toast.error('Código deve ter 6 dígitos');
      return;
    }
    start(async () => {
      const res = await fetch(`/api/bambu/verify-code`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), code: cleanCode }),
      });
      if (!res.ok) {
        toast.error(await parseError(res));
        return;
      }
      const body = (await res.json()) as BambuVerifyCodeResponse;
      setDevices(body.devices);
      setStep('success');
      toast.success(`Conta Bambu conectada — ${body.devices.length} impressora(s) detectada(s)`);
    });
  }

  return (
    <div className="container max-w-xl py-8 space-y-6">
      <PageHeader
        id="BAMBU"
        title="Conectar conta Bambu Cloud"
        description="Permite que o PrintStudio receba telemetria das impressoras direto da nuvem da Bambu, sem precisar de um bridge LAN."
      />

      {step === 'loading' && (
        <Card data-mc-card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            Carregando status da conexão…
          </CardContent>
        </Card>
      )}

      {step === 'connected' && status?.connected && (
        <Card data-mc-card>
          <CardHeader>
            <CardTitle>Conta Bambu conectada ✓</CardTitle>
            <CardDescription>
              Esta organização já está vinculada a uma conta Bambu Cloud. O worker
              recebe telemetria automaticamente.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-md border p-3 space-y-1 text-sm">
              <div>
                <span className="text-muted-foreground" data-mc-label>EMAIL:</span>{' '}
                <strong>{status.bambuEmail}</strong>
              </div>
              <div>
                <span className="text-muted-foreground" data-mc-label>USER-ID:</span>{' '}
                <code className="font-mono text-caption" data-mc-id>{status.bambuUserId}</code>
              </div>
              <div>
                <span className="text-muted-foreground" data-mc-label>TOKEN-EXP:</span>{' '}
                <span data-mc-num>{new Date(status.expiresAt).toLocaleString('pt-BR')}</span>
              </div>
              {status.lastSyncedAt && (
                <div>
                  <span className="text-muted-foreground" data-mc-label>SYNC-AT:</span>{' '}
                  <span data-mc-num>{new Date(status.lastSyncedAt).toLocaleString('pt-BR')}</span>
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={reset}
                disabled={pending}
              >
                Reconectar
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={disconnect}
                disabled={pending}
              >
                Desconectar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 'email' && (
        <Card data-mc-card>
          <CardHeader>
            <CardTitle>Passo 1 de 2 — Email da conta Bambu</CardTitle>
            <CardDescription>
              Vamos enviar um código de 6 dígitos pra esse email. Funciona com
              contas Google, Apple ou email/senha.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={sendCode} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email">Email Bambu Lab</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={pending}
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={pending}>
                {pending ? 'Enviando…' : 'Enviar código'}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {step === 'code' && (
        <Card data-mc-card>
          <CardHeader>
            <CardTitle>Passo 2 de 2 — Código de verificação</CardTitle>
            <CardDescription>
              Verifique a caixa de entrada de <strong>{email}</strong> e cole o
              código de 6 dígitos abaixo. Geralmente chega em 30 segundos.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={verifyCode} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="code">Código de 6 dígitos</Label>
                <Input
                  id="code"
                  inputMode="numeric"
                  pattern="\d{6}"
                  maxLength={6}
                  autoComplete="one-time-code"
                  placeholder="000000"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                  disabled={pending}
                  required
                  className="text-center font-mono text-lg tracking-widest"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setStep('email')}
                  disabled={pending}
                >
                  Voltar
                </Button>
                <Button type="submit" className="flex-1" disabled={pending}>
                  {pending ? 'Conectando…' : 'Conectar conta'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {step === 'success' && (
        <Card data-mc-card>
          <CardHeader>
            <CardTitle>Conta conectada ✓</CardTitle>
            <CardDescription>
              {devices.length === 0
                ? 'Nenhuma impressora vinculada à conta foi encontrada.'
                : `Detectadas ${devices.length} impressora${devices.length > 1 ? 's' : ''} na sua conta Bambu.`}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {devices.length > 0 && (
              <ul className="space-y-2">
                {devices.map((d) => (
                  <li
                    key={d.serial}
                    className="flex items-center justify-between rounded-md border p-3"
                  >
                    <div>
                      <div className="font-medium">{d.name}</div>
                      <div className="text-xs text-muted-foreground font-mono">
                        {d.model} · {d.serial}
                      </div>
                    </div>
                    <Badge variant={d.online ? 'default' : 'secondary'}>
                      {d.online ? 'online' : 'offline'}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
            <div className="text-xs text-muted-foreground">
              Próximo passo: o worker cloud vai começar a receber telemetria
              dessas impressoras em alguns segundos (Story 4.5).
            </div>
            <Button variant="outline" onClick={reset} className="w-full">
              Conectar outra conta
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
