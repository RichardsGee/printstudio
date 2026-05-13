# Design Specs — Epic 7: Landing + Waitlist

**Owner:** Uma (UX Design Expert)
**Status:** Ready for @dev
**Criado:** 2026-05-13
**Domain:** `guiaprint3d.com` (marketing) + `app.guiaprint3d.com` (autenticado)

## Sumário pra @dev

| Tela | Story | Prioridade | Componentes novos |
|------|-------|-----------|-------------------|
| Landing page | 7.2 | P0 | `<Hero>`, `<FeatureCard>`, `<WaitlistForm>`, `<DemoModal>`, `<Footer>`, `<MarketingHeader>` |
| Success page | 7.5 | P0 | `<SuccessConfirmation>` |
| Privacy/Terms | 7.4 | P0 | `<MarkdownDoc>` (renderiza MDX) |

**Tokens reusados:** mission-control.css (cores `--mc-*`, tipografia, brackets `data-mc-card`). Tudo herda do `<body class="kiosk-mission">`.

---

## 🎨 Filosofia de design

**Princípio orientador:** "Calibre profissional + identidade de comando"

- Mission Control mantém personalidade do produto desde o primeiro touch
- Form com **qualificação rica mas sem fricção** — campos opcionais marcados claramente
- **Mobile-first** (já é decisão Story 5.1) — design pensa primeiro em 375px
- **CTAs hierárquicos:** primary cyan (waitlist), secondary outline (demo)
- **Densidade controlada:** info importante respira, decoração subordinada

---

## 📝 COPY — Decisões finais

### Hero

```
TÍTULO:
Monitore suas Bambu Lab A1 de qualquer lugar.

SUBTITLE:
Kiosk de parede + cloud + multi-impressora.
Visual estilo Mission Control, dados em tempo real,
zero configuração de rede.

CTA PRIMÁRIO: [Entrar na lista de espera]
CTA SECUNDÁRIO: [▶ Ver demo (60s)]
```

### Features (4 cards)

```
1. // MISSION-VIEW
   Monitor visual estilo Mission Control
   Cards estáticos no kiosk com status em tempo real,
   ETA visual, alertas piscando. Pensado pra monitor
   de parede a 3m de distância.

2. // MULTI-PRINTER
   Reordene como quiser
   Drag-and-drop pra organizar a ordem das impressoras
   no kiosk. Renomeie pra etiquetagem visual.

3. // CLOUD-FIRST
   Sem bridge LAN, sem dor de cabeça
   Vincula direto à sua conta Bambu Cloud. Funciona
   de qualquer lugar do mundo, sem porta forwarding.

4. // ALWAYS-ON
   Histórico + alertas em tempo real
   Toda impressão fica gravada. Alertas HMS visíveis
   no kiosk sem precisar abrir o painel da Bambu.
```

### Waitlist form

```
SEÇÃO TÍTULO: // ACCESS REQUEST · WAITLIST

LABELS:
- Nome*
- Email*
- Estado* (selecione)
- Cidade
- Qual seu uso?* (selecione)
- Quantas Bambu você opera?* (radio)
- Telegram (@handle) — opcional, pra entrar na comunidade
- WhatsApp — opcional, pra receber novidades

ROLE OPTIONS:
- Hobbyista (1 Bambu em casa)
- Print shop pequena (1-3 impressoras)
- Estúdio (4-10 impressoras)
- Operação business (11+ impressoras)
- Outros (educação, comunidade maker)

BAMBU_COUNT OPTIONS:
- 1
- 2-3
- 4-10
- 11+

CHECKBOX:
☐ Aceito os [termos de uso] e [política de privacidade]*

SUBMIT: [Solicitar acesso]

DISCLAIMER ABAIXO:
Vamos te chamar assim que abrir o convite. Sem spam.
```

### Success page

```
TÍTULO: STATUS · CONFIRMED ✓
SUBTITLE: Você está na lista.
MAIN COPY:
Vamos te avisar assim que liberarmos seu acesso.
Geralmente chamamos em até 7 dias.

CTA: [← Voltar pra home]

DETAILS (sutis embaixo):
// Posição na fila: #{id}
// Cadastrado: {timestamp}
```

### Footer

```
LEFT:
// GUIAPRINT3D · 2026
Mission Control pra impressoras Bambu A1

LINKS:
Sobre · Política de privacidade · Termos · Contato
```

---

## 📐 WIREFRAMES — Landing page (story 7.2)

### Desktop (≥1024px)

```
┌────────────────────────────────────────────────────────────────────┐
│ Header (sticky, h-16)                                              │
│ ┌──────────────────────────────────────────────────────────────┐  │
│ │ ▌ GUIAPRINT3D          [Entrar na lista]  [▶ Ver demo]       │  │
│ └──────────────────────────────────────────────────────────────┘  │
│                                                                    │
│ Hero (min-h-[calc(100vh-h-16)], grid-cols-[3fr_2fr] gap-12)        │
│ ┌────────────────────────────────────┬─────────────────────────┐ │
│ │                                    │                          │ │
│ │  // PRINTSTUDIO · MISSION CONTROL  │   ┌─────────────────┐    │ │
│ │                                    │   │                  │   │ │
│ │  Monitore suas Bambu Lab A1        │   │  [GIF kiosk]    │   │ │
│ │  de qualquer lugar.                │   │   animado       │   │ │
│ │                                    │   │   ~10-20s loop  │   │ │
│ │  Kiosk de parede + cloud +         │   │                  │   │ │
│ │  multi-impressora.                 │   │  aspect-video    │   │ │
│ │  Visual Mission Control,           │   │                  │   │ │
│ │  zero configuração.                │   └─────────────────┘   │ │
│ │                                    │                          │ │
│ │  ┌──────────────────────────┐      │                          │ │
│ │  │ Entrar na lista de espera│      │                          │ │
│ │  └──────────────────────────┘      │                          │ │
│ │  ┌──────────────────────────┐      │                          │ │
│ │  │ ▶ Ver demo (60s)         │      │                          │ │
│ │  └──────────────────────────┘      │                          │ │
│ └────────────────────────────────────┴─────────────────────────┘ │
│                                                                    │
│ ─────────────── grid background (mission-control.css) ──────────── │
│                                                                    │
│ Features section (max-w-5xl, py-20)                                │
│ ┌────────────────────────────────────────────────────────────┐    │
│ │  // CAPABILITIES                                            │    │
│ │                                                              │    │
│ │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │    │
│ │  │data-mc-  │  │data-mc-  │  │data-mc-  │  │data-mc-  │   │    │
│ │  │  card    │  │  card    │  │  card    │  │  card    │   │    │
│ │  │          │  │          │  │          │  │          │   │    │
│ │  │ //MISSION│  │//MULTI-  │  │ //CLOUD- │  │//ALWAYS- │   │    │
│ │  │ -VIEW    │  │ PRINTER  │  │   FIRST  │  │   ON     │   │    │
│ │  │          │  │          │  │          │  │          │   │    │
│ │  │ Monitor  │  │Reordene  │  │ Sem      │  │Histórico │   │    │
│ │  │ visual   │  │como quiser│ │ bridge   │  │+ alertas │   │    │
│ │  │ MissionC │  │drag-and- │  │ LAN     │  │tempo real│   │    │
│ │  │          │  │drop      │  │          │  │          │   │    │
│ │  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │    │
│ │                                                              │    │
│ └────────────────────────────────────────────────────────────┘    │
│                                                                    │
│ Waitlist Form section (max-w-2xl, py-20)                           │
│ ┌────────────────────────────────────────────────────────────┐    │
│ │ ┌──── data-mc-card ──────────────────────────────────┐    │    │
│ │ │                                                      │    │    │
│ │ │  // ACCESS REQUEST · WAITLIST                       │    │    │
│ │ │                                                      │    │    │
│ │ │  ┌────────────────────────────────────────────────┐ │    │    │
│ │ │  │ Nome*                                          │ │    │    │
│ │ │  │ [input]                                        │ │    │    │
│ │ │  └────────────────────────────────────────────────┘ │    │    │
│ │ │  ┌────────────────────────────────────────────────┐ │    │    │
│ │ │  │ Email*                                         │ │    │    │
│ │ │  │ [input]                                        │ │    │    │
│ │ │  └────────────────────────────────────────────────┘ │    │    │
│ │ │                                                      │    │    │
│ │ │  ┌──────────────┐  ┌────────────────────────────┐ │    │    │
│ │ │  │ Estado*      │  │ Cidade                     │ │    │    │
│ │ │  │ [dropdown ▼] │  │ [input]                    │ │    │    │
│ │ │  └──────────────┘  └────────────────────────────┘ │    │    │
│ │ │                                                      │    │    │
│ │ │  ┌────────────────────────────────────────────────┐ │    │    │
│ │ │  │ Qual seu uso?*                                 │ │    │    │
│ │ │  │ [dropdown ▼]                                   │ │    │    │
│ │ │  └────────────────────────────────────────────────┘ │    │    │
│ │ │                                                      │    │    │
│ │ │  Quantas Bambu você opera?*                         │    │    │
│ │ │  ◯ 1   ◯ 2-3   ◯ 4-10   ◯ 11+                       │    │    │
│ │ │                                                      │    │    │
│ │ │  ┌────────────────────────────────────────────────┐ │    │    │
│ │ │  │ Telegram (@handle) — opcional                  │ │    │    │
│ │ │  │ [input]                                        │ │    │    │
│ │ │  └────────────────────────────────────────────────┘ │    │    │
│ │ │  ┌────────────────────────────────────────────────┐ │    │    │
│ │ │  │ WhatsApp — opcional                            │ │    │    │
│ │ │  │ [input phone mask]                             │ │    │    │
│ │ │  └────────────────────────────────────────────────┘ │    │    │
│ │ │                                                      │    │    │
│ │ │  ☐ Aceito termos + política de privacidade*        │    │    │
│ │ │                                                      │    │    │
│ │ │  ┌──────────────────────────────────────────────┐  │    │    │
│ │ │  │       Solicitar acesso                        │  │    │    │
│ │ │  └──────────────────────────────────────────────┘  │    │    │
│ │ │                                                      │    │    │
│ │ │  Vamos te chamar assim que abrir. Sem spam.         │    │    │
│ │ │                                                      │    │    │
│ │ │  <input type="hidden" name="website" />  (HONEYPOT) │    │    │
│ │ └──────────────────────────────────────────────────┘ │    │    │
│ └────────────────────────────────────────────────────────────┘    │
│                                                                    │
│ Footer (h-20)                                                      │
│ ┌────────────────────────────────────────────────────────────┐    │
│ │ // GUIAPRINT3D · 2026     Sobre · Privacidade · Termos · Contato│
│ │ Mission Control pra Bambu A1                                │    │
│ └────────────────────────────────────────────────────────────┘    │
└────────────────────────────────────────────────────────────────────┘
```

### Mobile (375px)

```
┌─────────────────────────────┐
│ ▌ GUIAPRINT3D    [Entrar]   │ ← header sticky (h-14), "Ver demo" some
├─────────────────────────────┤
│                             │
│ // PRINTSTUDIO ·            │
│ MISSION CONTROL             │
│                             │
│ Monitore suas Bambu A1      │
│ de qualquer lugar.          │
│                             │
│ Kiosk de parede + cloud +   │
│ multi-impressora.           │
│                             │
│ ┌─────────────────────────┐ │
│ │ Entrar na lista de      │ │ h-11 touch (full-width)
│ │ espera                  │ │
│ └─────────────────────────┘ │
│ ┌─────────────────────────┐ │
│ │ ▶ Ver demo (60s)        │ │ h-11 outline (full-width)
│ └─────────────────────────┘ │
│                             │
│ ┌─────────────────────────┐ │
│ │                         │ │
│ │   [GIF kiosk]           │ │
│ │   aspect-video          │ │
│ │                         │ │
│ └─────────────────────────┘ │
│                             │
├─────────────────────────────┤
│                             │
│ // CAPABILITIES             │
│                             │
│ ┌─────────────────────────┐ │
│ │ //MISSION-VIEW          │ │ ← Cards empilhados, 1col
│ │ Monitor visual estilo   │ │
│ │ Mission Control...      │ │
│ └─────────────────────────┘ │
│ ┌─────────────────────────┐ │
│ │ //MULTI-PRINTER         │ │
│ │ Reordene como quiser... │ │
│ └─────────────────────────┘ │
│ ┌─────────────────────────┐ │
│ │ //CLOUD-FIRST           │ │
│ │ Sem bridge LAN...       │ │
│ └─────────────────────────┘ │
│ ┌─────────────────────────┐ │
│ │ //ALWAYS-ON             │ │
│ │ Histórico + alertas...  │ │
│ └─────────────────────────┘ │
│                             │
├─────────────────────────────┤
│                             │
│ ┌── data-mc-card ────────┐  │
│ │ // ACCESS REQUEST      │  │
│ │                        │  │
│ │ ┌────────────────────┐ │  │
│ │ │ Nome*              │ │  │
│ │ └────────────────────┘ │  │
│ │ ┌────────────────────┐ │  │
│ │ │ Email*             │ │  │
│ │ └────────────────────┘ │  │
│ │ ┌────────────────────┐ │  │
│ │ │ Estado* ▼          │ │  │
│ │ └────────────────────┘ │  │
│ │ ┌────────────────────┐ │  │
│ │ │ Cidade             │ │  │
│ │ └────────────────────┘ │  │
│ │ ┌────────────────────┐ │  │
│ │ │ Qual seu uso?* ▼   │ │  │
│ │ └────────────────────┘ │  │
│ │                        │  │
│ │ Quantas Bambu?*        │  │
│ │ ◯ 1                    │  │ ← Radio empilhado em mobile
│ │ ◯ 2-3                  │  │
│ │ ◯ 4-10                 │  │
│ │ ◯ 11+                  │  │
│ │                        │  │
│ │ ┌────────────────────┐ │  │
│ │ │ Telegram (opc)     │ │  │
│ │ └────────────────────┘ │  │
│ │ ┌────────────────────┐ │  │
│ │ │ WhatsApp (opc)     │ │  │
│ │ └────────────────────┘ │  │
│ │                        │  │
│ │ ☐ Aceito termos*       │  │
│ │                        │  │
│ │ ┌────────────────────┐ │  │
│ │ │ Solicitar acesso   │ │  │ h-11 touch
│ │ └────────────────────┘ │  │
│ │                        │  │
│ │ Sem spam.              │  │
│ └────────────────────────┘  │
│                             │
├─────────────────────────────┤
│ Footer                      │
│ // GUIAPRINT3D · 2026       │
│ Sobre · Política · Termos   │
└─────────────────────────────┘
```

---

## 📐 WIREFRAME — Success page (story 7.5)

### Desktop + Mobile (mesma estrutura, centralizada)

```
┌────────────────────────────────────────────────────────────────────┐
│ Header (mesmo da landing, sticky)                                  │
│ ▌ GUIAPRINT3D                                                     │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│                                                                    │
│                                                                    │
│              ┌── data-mc-card max-w-md ────────────┐               │
│              │                                      │               │
│              │   ✓                                  │               │
│              │                                      │               │
│              │   STATUS · CONFIRMED                 │               │
│              │   ───────────────────                │               │
│              │                                      │               │
│              │   Você está na lista.                │               │
│              │                                      │               │
│              │   Vamos te avisar assim que          │               │
│              │   liberarmos seu acesso.             │               │
│              │   Geralmente chamamos em até 7 dias. │               │
│              │                                      │               │
│              │   ┌────────────────────────────────┐ │               │
│              │   │ ← Voltar pra home              │ │               │
│              │   └────────────────────────────────┘ │               │
│              │                                      │               │
│              │   // POSIÇÃO NA FILA · #{id}         │               │
│              │   // CADASTRADO · {timestamp}        │               │
│              │                                      │               │
│              └──────────────────────────────────────┘               │
│                                                                    │
│                                                                    │
├────────────────────────────────────────────────────────────────────┤
│ Footer                                                             │
└────────────────────────────────────────────────────────────────────┘
```

**Notas:**
- Sem CTAs de comunidade V1 (decisão fechada — Telegram/WhatsApp são V1.1)
- Position e timestamp são sutis (`text-caption text-muted-foreground`), não chamativos
- Centralizado com `grid place-items-center min-h-[calc(100vh-h-16)]`

---

## 🧩 Componentes atômicos necessários

### Reutilizados (já existem em `apps/web/src/components/ui/`)

- `<Button>` (default, outline, ghost variants)
- `<Card>` (Hero usa, Feature cards usam, WaitlistForm usa)
- `<Input>`, `<Label>`
- `<Dialog>` (pro DemoModal)
- `<PageHeader>` (success page pode usar)

### Novos a criar em `apps/marketing/src/components/` (não confunde com apps/web)

1. **`<MarketingHeader>`** (organism)
   - Logo + 2 CTAs (entrar lista + ver demo)
   - Sticky com `backdrop-blur`
   - Mobile: esconde "Ver demo"

2. **`<Hero>`** (template)
   - Grid 3fr_2fr desktop, 1fr mobile
   - Slot pra título + subtitle + CTAs + asset visual
   - `min-h-[calc(100vh-h-16)]`

3. **`<FeatureCard>`** (molecule)
   - Prop: `id` (ex: "MISSION-VIEW"), `title`, `description`
   - Renderiza `<Card data-mc-card>` com `// ID` no topo

4. **`<WaitlistForm>`** (organism) — **MAIS COMPLEXO**
   - 9 fields conforme spec
   - Honeypot escondido (CSS: `position: absolute; left: -9999px`)
   - Submit calls server action ou fetch
   - Loading state no botão
   - Error inline (validação Zod)
   - Acessibilidade: labels, aria-required, aria-invalid

5. **`<DemoModal>`** (organism)
   - Radix Dialog wrapping iframe YouTube
   - Aspect 16:9 responsivo
   - Trigger: botão "Ver demo"
   - Close: X button + esc key + overlay click

6. **`<Footer>`** (organism)
   - 4 links de navegação
   - Texto institucional curto
   - Compact em mobile

7. **`<SuccessConfirmation>`** (organism)
   - Ícone check grande
   - PageHeader-like com `// STATUS · CONFIRMED`
   - Slots: mensagem, CTA, detalhes (metadata)

8. **`<MarkdownDoc>`** (template — pra story 7.4)
   - Renderiza MDX/markdown com tipografia Mission Control
   - Layout: max-w-3xl, prose styles
   - Heading hierarchy: h1=text-display, h2=text-heading, h3=text-body-lg

### Helpers/utilitários

- `lib/br-states.ts` — array dos 27 UFs BR
- `lib/zod-schemas/waitlist.ts` — schema compartilhado (story 7.3)
- `lib/use-form.ts` — hook simples (sem react-hook-form pra economizar deps)
- `lib/track-utm.ts` — captura UTM params via useSearchParams

---

## 🎨 Validação paleta + tipografia

### Paleta (reusa mission-control.css)

```css
/* Já disponíveis via .kiosk-mission */
--mc-accent: #22d3ee        /* cyan brilhante — PRIMARY ACTIONS */
--mc-accent-soft: #0891b2   /* cyan escuro — borders, accents */
--mc-warning: #fbbf24       /* amber — não usado V1 landing */
--mc-danger: #ef4444        /* red — erros de form */
--mc-success: #34d399       /* green — sucesso form submit */
--mc-bg: #050810            /* background base */
--mc-fg: #d1d5db            /* foreground principal */
--mc-fg-dim: #6b7280        /* foreground secondary */
```

**Aplicação visual:**
- Hero title: `text-foreground` (mc-fg)
- "// PRINTSTUDIO · MISSION CONTROL" prefix: `text-primary` (override pra mc-accent)
- CTA primary: `bg-primary text-primary-foreground` (mc-accent + dark text)
- CTA secondary outline: `border-primary text-primary` (cyan outline)
- Feature card titles: `text-primary` no `// ID`
- Form labels: `text-foreground` normal
- Disclaimers: `text-caption text-muted-foreground`
- Background grid: já automático via `.kiosk-mission`
- Card brackets: já automático via `[data-mc-card]`

### Tipografia (reusa tokens em globals.css)

| Token | Tamanho | Uso |
|-------|---------|-----|
| `text-display` | 1.875rem (30px) | Hero title |
| `text-heading` | 1.25rem (20px) | Feature card titles, success title |
| `text-body-lg` | 1rem (16px) | Hero subtitle |
| `text-body` | 0.875rem (14px) | Body padrão, form labels, mensagens |
| `text-small` | 0.75rem (12px) | Apenas marketing site? V1.1, no momento mobile-safe = text-body |
| `text-caption` | 0.6875rem (11px) | Meta info (// IDs, timestamps) |
| `text-micro` | 0.625rem (10px) | Apenas labels mono uppercase em data-mc-label |

**Importante mobile (Story 5.1):** body text **>=14px** em mobile. Não usar `text-small`/`text-caption` pra conteúdo principal — só pra metadata.

---

## 🎬 Interações + micro-interactions

### Hero
- **GIF asset:** loop infinito 10-20s. Lazy load com placeholder (LQIP ou cor sólida)
- **CTA primary hover:** `scale-[1.02]` + `shadow-lg` (`hover:scale-[1.02] hover:shadow-lg transition`)
- **CTA secondary hover:** `bg-primary/10` (highlight sutil)

### Demo Modal
- **Open:** fade in overlay 200ms + slide up content 300ms
- **Close:** reverso. Esc + click overlay + X button
- **YouTube embed:** lazy load via `<iframe loading="lazy">`

### Waitlist form
- **Field focus:** `ring-2 ring-primary/40`
- **Field error:** `border-danger` + texto `text-caption text-danger mt-1`
- **Submit disabled state:** opacity 0.5 + cursor not-allowed quando pending
- **Submit pending:** texto vira "[PROCESSANDO...]" com `Loader2 animate-spin`
- **Success:** redirect imediato pra `/sucesso`

### Animações Mission Control herdadas
- `mc-boot` no body mount (480ms fade-in)
- `mc-scanline-drift` background continua
- Não adicionar animações que conflitem

---

## 📱 Responsivo — breakpoints

| Breakpoint | Largura | Comportamento |
|------------|---------|---------------|
| `<sm` (375-639px) | mobile | 1 col, hamburger no header só com logo, CTAs full-width, radio empilhado |
| `sm` (640-767px) | mobile XL | igual mobile + small tweaks |
| `md` (768-1023px) | tablet | features grid 2 cols, hero stacked, form continua 1 col |
| `lg` (1024-1279px) | desktop | features grid 4 cols, hero grid 3fr_2fr, form max-w-2xl |
| `xl` (1280px+) | wide | mesmo lg, max-width content centralizado |

---

## 🚦 Quality Gates pra @dev

Antes de marcar Story 7.2 e 7.5 como Done:

- [ ] Mobile 375px sem scroll horizontal (validar em DevTools iPhone SE)
- [ ] Lighthouse Mobile: Performance >= 90, Accessibility >= 95, SEO >= 95
- [ ] Touch targets >= 44px (Story 5.1 padrão)
- [ ] Tipografia body >= 14px em mobile
- [ ] Tab navigation funcional (form acessível via teclado)
- [ ] CTAs claramente distinguíveis (primary vs secondary)
- [ ] Demo modal funciona em mobile (iframe responsivo)
- [ ] Validação form server-side rejeita payloads inválidos (story 7.3)
- [ ] Honeypot funciona (testar via curl manual com `website=spam`)
- [ ] Visual Mission Control consistente com app autenticado

---

## 🔄 Próximos passos design (after Epic 7)

Quando @dev terminar Epic 7, retomamos pra:

1. **Epic 8 — Onboarding Wizard** (stories 8.1, 8.3-8.5, 8.7)
   - Signup form
   - Wizard 3 steps com progress
   - Banner persistente
   - Estimativa: ~1d de design

2. **Epic 9 — Admin Panel** (stories 9.2, 9.3, 9.5, 9.6, 9.8)
   - Layout admin sidebar
   - Tables complexas com filtros
   - Detail org abas
   - Métricas dashboard
   - Estimativa: ~2d de design

3. **Epic 6 — Billing UI** (stories 6.3, 6.4)
   - Comparação planos
   - Upgrade flow com captura fiscal
   - Painel cobrança
   - Estimativa: ~1d de design

**Total design pendente:** ~4 dias após Phase 1.

— Uma, desenhando com empatia 💝
