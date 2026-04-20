'use client';

import type { AmsSlot } from '@printstudio/shared';

/**
 * AMS Lite — fully drawn SVG (no photo background).
 *
 * Layout matches the physical unit:
 *   - V-stand at bottom
 *   - Central white "trunk" connecting the feeder cluster
 *   - 4 feeder motor heads at the top with gold fittings + status LEDs
 *   - 4 spools arranged in a staggered 2x2 (slots 1 & 2 behind/upper,
 *     3 & 4 front/lower), each drawn as a colored disk
 *   - Translucent outer flanges
 *   - PTFE tubes routing from each feeder up to a shared exit
 *
 * Each spool's color, active flag, and filament type come from the live
 * data and are applied directly to the SVG elements — no blending tricks.
 */

const VB_W = 360;
const VB_H = 260;

// Staggered 2x2 positions (cx, cy) per slot in the viewBox.
const POS = [
  { cx: 140, cy: 95,  scale: 0.82 },  // slot 1 — rear-left (smaller due to depth)
  { cx: 220, cy: 95,  scale: 0.82 },  // slot 2 — rear-right
  { cx: 118, cy: 165, scale: 1.0  },  // slot 3 — front-left
  { cx: 242, cy: 165, scale: 1.0  },  // slot 4 — front-right
];

// Feeder head positions above each spool
const FEEDER = [
  { cx: 140, cy: 56 },
  { cx: 220, cy: 56 },
  { cx: 118, cy: 73 },
  { cx: 242, cy: 73 },
];

interface Props {
  slots: AmsSlot[];
  className?: string;
}

export function AmsLiteSvg({ slots, className }: Props) {
  const slotMap: (AmsSlot | null)[] = Array.from({ length: 4 }, (_, i) =>
    slots.find((s) => s.slot === i) ?? null,
  );

  return (
    <svg
      viewBox={`0 0 ${VB_W} ${VB_H}`}
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label="AMS Lite"
    >
      <defs>
        <linearGradient id="ams-stand" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#4a4d56" />
          <stop offset="100%" stopColor="#1c1e23" />
        </linearGradient>
        <linearGradient id="ams-trunk" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#d0d2d8" />
        </linearGradient>
        <linearGradient id="ams-feeder" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#3a3d46" />
          <stop offset="100%" stopColor="#1a1c22" />
        </linearGradient>
        <linearGradient id="tube-active" x1="0" x2="0" y1="1" y2="0">
          <stop offset="0%" stopColor="rgba(59,130,246,0.95)" />
          <stop offset="100%" stopColor="rgba(59,130,246,0.15)" />
        </linearGradient>
        <radialGradient id="spool-inner-shade" cx="0.4" cy="0.35" r="0.7">
          <stop offset="0%" stopColor="rgba(255,255,255,0.4)" />
          <stop offset="55%" stopColor="rgba(0,0,0,0)" />
          <stop offset="100%" stopColor="rgba(0,0,0,0.55)" />
        </radialGradient>
      </defs>

      {/* V-stand */}
      <path
        d={`M ${VB_W / 2 - 95} ${VB_H - 8}
            L ${VB_W / 2} ${VB_H - 65}
            L ${VB_W / 2 + 95} ${VB_H - 8}
            L ${VB_W / 2 + 72} ${VB_H - 8}
            L ${VB_W / 2} ${VB_H - 45}
            L ${VB_W / 2 - 72} ${VB_H - 8} Z`}
        fill="url(#ams-stand)"
        stroke="#1c1e23"
        strokeWidth="1"
      />
      <rect x={VB_W / 2 - 108} y={VB_H - 12} width="216" height="6" rx="3" fill="#14161a" />

      {/* Central white trunk */}
      <rect
        x={VB_W / 2 - 10}
        y={65}
        width="20"
        height={VB_H - 85}
        rx="3"
        fill="url(#ams-trunk)"
        stroke="#b8bac0"
        strokeWidth="0.5"
      />

      {/* Tubes — one curve per slot from its feeder to a shared exit top-right */}
      {slotMap.map((slot, i) => {
        const f = FEEDER[i]!;
        const exitX = VB_W - 36;
        const exitY = 10;
        const active = !!slot?.active;
        const d = `M ${f.cx} ${f.cy - 10} C ${f.cx} ${f.cy - 45}, ${exitX} ${exitY + 55}, ${exitX} ${exitY + 2}`;
        return (
          <path
            key={`tube-${i}`}
            d={d}
            fill="none"
            stroke={active ? 'url(#tube-active)' : '#cfd4dd'}
            strokeWidth={active ? 2.5 : 1.8}
            strokeLinecap="round"
            strokeDasharray={active ? '5 4' : undefined}
          >
            {active ? (
              <animate attributeName="stroke-dashoffset" from="0" to="-18" dur="0.7s" repeatCount="indefinite" />
            ) : null}
          </path>
        );
      })}

      {/* Tube exit on top-right */}
      <g>
        <rect x={VB_W - 44} y={4} width={18} height={12} rx="3" fill="#1a1c22" stroke="#3a3d46" />
        <circle cx={VB_W - 35} cy={10} r="2" fill="#0b0c10" />
      </g>

      {/* REAR spools (drawn first so front ones overlap) */}
      {[0, 1].map((i) => (
        <Spool key={`s${i}`} slot={slotMap[i]} slotIndex={i} pos={POS[i]!} />
      ))}

      {/* Feeder cluster: 4 motor heads in a 2x2 arrangement */}
      {FEEDER.map((f, i) => (
        <FeederHead key={`f${i}`} x={f.cx} y={f.cy} num={i + 1} active={!!slotMap[i]?.active} />
      ))}

      {/* FRONT spools (over feeders) */}
      {[2, 3].map((i) => (
        <Spool key={`s${i}`} slot={slotMap[i]} slotIndex={i} pos={POS[i]!} />
      ))}

      {/* Slot labels */}
      {slotMap.map((slot, i) => {
        const p = POS[i]!;
        const active = !!slot?.active;
        const r = 34 * p.scale;
        return (
          <text
            key={`lbl-${i}`}
            x={p.cx}
            y={p.cy + r + 12}
            textAnchor="middle"
            fontFamily="ui-monospace, monospace"
            fontSize="8"
            letterSpacing="1"
            fill={active ? '#60a5fa' : 'rgba(255,255,255,0.5)'}
          >
            SLOT {i + 1}
          </text>
        );
      })}
    </svg>
  );
}

function FeederHead({ x, y, num, active }: { x: number; y: number; num: number; active: boolean }) {
  return (
    <g>
      {/* Main motor block */}
      <rect x={x - 14} y={y - 12} width="28" height="22" rx="5" fill="url(#ams-feeder)" stroke="#3a3d46" strokeWidth="0.8" />
      {/* Two round motor caps on top */}
      <circle cx={x - 6} cy={y - 7} r="3.5" fill="#2a2d35" stroke="#0b0c10" strokeWidth="0.5" />
      <circle cx={x + 6} cy={y - 7} r="3.5" fill="#2a2d35" stroke="#0b0c10" strokeWidth="0.5" />
      {/* Slot number on one cap */}
      <text x={x - 6} y={y - 5.5} textAnchor="middle" fontFamily="ui-monospace, monospace" fontSize="5" fill="rgba(255,255,255,0.6)">
        {num}
      </text>
      {/* Gold fittings below */}
      <circle cx={x - 4} cy={y + 5} r="2" fill={active ? '#fbbf24' : '#b45309'} stroke="rgba(0,0,0,0.3)" strokeWidth="0.5">
        {active ? (
          <animate attributeName="opacity" values="1;0.5;1" dur="1.2s" repeatCount="indefinite" />
        ) : null}
      </circle>
      <circle cx={x + 4} cy={y + 5} r="2" fill={active ? '#fbbf24' : '#b45309'} stroke="rgba(0,0,0,0.3)" strokeWidth="0.5">
        {active ? (
          <animate attributeName="opacity" values="1;0.5;1" dur="1.2s" repeatCount="indefinite" />
        ) : null}
      </circle>
    </g>
  );
}

function Spool({
  slot,
  pos,
}: {
  slot: AmsSlot | null;
  slotIndex: number;
  pos: { cx: number; cy: number; scale: number };
}) {
  const { cx, cy, scale } = pos;
  const r = 34 * scale;
  const hole = r / 3.2;
  const hex = normalizeHex(slot?.color);
  const active = !!slot?.active;
  const pct = slot?.remainingPct ?? null;
  const ringR = r - 3;
  const circumference = 2 * Math.PI * ringR;
  const dashOffset = pct === null ? 0 : circumference - (Math.max(0, Math.min(100, pct)) / 100) * circumference;

  return (
    <g>
      {/* Active outer glow */}
      {active ? (
        <circle cx={cx} cy={cy} r={r + 4} fill="none" stroke="rgba(59,130,246,0.45)" strokeWidth="1.5" />
      ) : null}

      {/* Translucent outer flange — always visible even without data */}
      <circle cx={cx} cy={cy} r={r + 2} fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.3)" strokeWidth="0.8" />

      {/* Rotating core: filament disk + windings + tick */}
      <g>
        {active ? (
          <animateTransform
            attributeName="transform"
            type="rotate"
            from={`0 ${cx} ${cy}`}
            to={`360 ${cx} ${cy}`}
            dur="5s"
            repeatCount="indefinite"
          />
        ) : null}

        {hex ? (
          <>
            {/* Filament color fill */}
            <circle cx={cx} cy={cy} r={r} fill={hex} stroke="rgba(0,0,0,0.3)" strokeWidth="0.5" />
            {/* Depth shade */}
            <circle cx={cx} cy={cy} r={r} fill="url(#spool-inner-shade)" />
            {/* Winding lines */}
            {[0.88, 0.76, 0.64, 0.52, 0.4].map((f) => (
              <circle
                key={f}
                cx={cx}
                cy={cy}
                r={r * f}
                fill="none"
                stroke="rgba(0,0,0,0.18)"
                strokeWidth="0.5"
              />
            ))}
            {/* Highlight crescent */}
            <path
              d={`M ${cx - r * 0.7} ${cy - r * 0.15} A ${r * 0.9} ${r * 0.9} 0 0 1 ${cx - r * 0.15} ${cy - r * 0.7}`}
              fill="none"
              stroke="rgba(255,255,255,0.35)"
              strokeWidth="1"
              strokeLinecap="round"
            />
            {/* Rotation tick so spinning is obvious */}
            <rect x={cx - 0.7} y={cy - r + 2} width="1.4" height="5" fill="rgba(0,0,0,0.5)" rx="0.5" />
            {/* Center bore */}
            <circle cx={cx} cy={cy} r={hole} fill="#0b0c10" stroke="rgba(255,255,255,0.12)" strokeWidth="0.5" />
            {/* Hub notch (also rotates) */}
            <circle cx={cx} cy={cy - hole + 1.8} r="0.8" fill="rgba(255,255,255,0.45)" />
          </>
        ) : (
          <>
            {/* Empty slot */}
            <circle
              cx={cx}
              cy={cy}
              r={r}
              fill="rgba(255,255,255,0.03)"
              stroke="rgba(255,255,255,0.2)"
              strokeWidth="0.8"
              strokeDasharray="4 4"
            />
            <circle cx={cx} cy={cy} r={hole} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="0.5" />
          </>
        )}
      </g>

      {/* Remaining-% arc (outside rotating group so it stays steady) */}
      {hex && pct !== null ? (
        <circle
          cx={cx}
          cy={cy}
          r={ringR}
          fill="none"
          stroke={active ? '#3b82f6' : 'rgba(255,255,255,0.6)'}
          strokeWidth="1.5"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          transform={`rotate(-90 ${cx} ${cy})`}
        />
      ) : null}

      {/* Center hub cover (on top of rotating content for the real AMS look) */}
      <circle cx={cx} cy={cy} r={hole * 1.4} fill="none" />
    </g>
  );
}

function normalizeHex(color: string | null | undefined): string | null {
  if (!color) return null;
  const m = color.match(/^#?([0-9a-fA-F]{6,8})$/);
  if (!m) return null;
  return `#${m[1]}`;
}
