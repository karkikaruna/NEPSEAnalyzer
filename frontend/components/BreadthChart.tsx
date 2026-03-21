'use client';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';

interface Props {
  gainers:   number;
  losers:    number;
  unchanged: number;
}

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="card p-2 text-xs font-mono">
      <span style={{ color: payload[0].payload.fill }}>{payload[0].name}: </span>
      <strong>{payload[0].value}</strong>
    </div>
  );
};

export default function BreadthChart({ gainers, losers, unchanged }: Props) {
  const data = [
    { name: 'Gainers',   value: gainers,   fill: '#00d4aa' },
    { name: 'Losers',    value: losers,    fill: '#ff4d6d' },
    { name: 'Unchanged', value: unchanged, fill: '#4a5568' },
  ];
  const total = gainers + losers + unchanged;

  return (
    <div className="card p-4 flex flex-col items-center animate-fadeUp" style={{ animationDelay: '150ms' }}>
      <h2 className="font-bold text-lg mb-1 self-start">Market Breadth</h2>
      <p className="text-xs font-mono self-start mb-2" style={{ color: 'var(--dim)' }}>
        {total} total symbols
      </p>
      <ResponsiveContainer width="100%" height={180}>
        <PieChart>
          <Pie data={data} dataKey="value" cx="50%" cy="50%" innerRadius={50} outerRadius={75} paddingAngle={2}>
            {data.map((d, i) => <Cell key={i} fill={d.fill}/>)}
          </Pie>
          <Tooltip content={<CustomTooltip/>}/>
        </PieChart>
      </ResponsiveContainer>
      <div className="flex gap-4 mt-2">
        {data.map(d => (
          <div key={d.name} className="text-center">
            <div className="text-lg font-bold font-mono" style={{ color: d.fill }}>{d.value}</div>
            <div className="text-xs font-mono" style={{ color: 'var(--dim)' }}>{d.name}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
