'use client';

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';

interface SignupsLineChartProps {
  data: Array<{ date: string; count: number }>;
}

/**
 * Line chart de signups por dia (últimos 30d). Recharts já no
 * projeto; mantém visual Mission Control via colors do theme.
 *
 * Story 9.8. Consome `signupsLast30Days` de `getAdminMetrics`.
 */
export function SignupsLineChart({ data }: SignupsLineChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center text-caption font-mono uppercase tracking-wider text-muted-foreground">
        {'// NO SIGNUPS YET'}
      </div>
    );
  }

  return (
    <div className="h-48 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={data}
          margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="var(--mc-accent-soft)"
            opacity={0.2}
          />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 10, fill: 'currentColor' }}
            stroke="var(--mc-accent-soft)"
            tickFormatter={(v: string) => v.slice(5)}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fontSize: 10, fill: 'currentColor' }}
            stroke="var(--mc-accent-soft)"
            width={28}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'hsl(var(--card))',
              border: '1px solid var(--mc-accent-soft)',
              borderRadius: '4px',
              fontSize: '11px',
            }}
            labelStyle={{ fontFamily: 'monospace', textTransform: 'uppercase' }}
          />
          <Line
            type="monotone"
            dataKey="count"
            stroke="hsl(var(--primary))"
            strokeWidth={2}
            dot={{ r: 3, fill: 'hsl(var(--primary))' }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
