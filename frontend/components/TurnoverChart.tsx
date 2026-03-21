'use client';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid,
} from 'recharts';
import { fmtCr } from '@/lib/api';

interface Item {
  symbol: string;
  turnover: number;
  volume: number;
  close_price: number;
}

interface Props { data: Item[]; }

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="card p-3 text-xs font-mono" style={{ minWidth: 160 }}>
      <div className="font-bold mb-1" style={{ color: 'var(--accent)' }}>{label}</div>
      <div style={{ color: 'var(--dim)' }}>Turnover: <span style={{ color: 'var(--text)' }}>{fmtCr(d.turnover)}</span></div>
      <div style={{ color: 'var(--dim)' }}>Volume: <span style={{ color: 'var(--text)' }}>{d.volume?.toLocaleString()}</span></div>
      <div style={{ color: 'var(--dim)' }}>LTP: <span style={{ color: 'var(--text)' }}>{Number(d.close_price).toFixed(2)}</span></div>
    </div>
  );
};

const COLORS = [
  '#00d4aa','#00c4a0','#00b496','#00a48c','#009482',
  '#f5c842','#e8b83a','#dba832','#ce982a','#c18822',
  '#ff4d6d','#f04463','#e13b59','#d2324f','#c32945',
];

export default function TurnoverChart({ data }: Props) {
  return (
    <div className="card p-4 animate-fadeUp" style={{ animationDelay: '200ms' }}>
      <div className="mb-4">
        <h2 className="font-bold text-lg">Top 15 by Turnover</h2>
        <p className="text-xs font-mono" style={{ color: 'var(--dim)' }}>Most actively traded stocks</p>
      </div>
      <ResponsiveContainer width="100%" height={320}>
        <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 60 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false}/>
          <XAxis
            dataKey="symbol"
            tick={{ fill: 'var(--dim)', fontSize: 10, fontFamily: 'var(--font-mono)' }}
            angle={-45}
            textAnchor="end"
            interval={0}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tickFormatter={(v: number) => fmtCr(v)}
            tick={{ fill: 'var(--dim)', fontSize: 10, fontFamily: 'var(--font-mono)' }}
            axisLine={false}
            tickLine={false}
            width={80}
          />
          <Tooltip content={<CustomTooltip/>} cursor={{ fill: 'rgba(255,255,255,.04)' }}/>
          <Bar dataKey="turnover" radius={[4,4,0,0]}>
            {data.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]}/>
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
