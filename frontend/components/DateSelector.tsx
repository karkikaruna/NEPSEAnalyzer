'use client';
import { CalendarDays } from 'lucide-react';

interface Props {
  dates:    string[];
  selected: string;
  onChange: (d: string) => void;
}

export default function DateSelector({ dates, selected, onChange }: Props) {
  return (
    <div className="flex items-center gap-2">
      <CalendarDays size={16} style={{ color: 'var(--dim)' }}/>
      <select
        value={selected}
        onChange={e => onChange(e.target.value)}
        className="text-sm font-mono rounded-lg px-3 py-2 outline-none cursor-pointer"
        style={{
          background: 'var(--card)',
          border: '1px solid var(--border)',
          color: 'var(--text)',
        }}
      >
        {dates.map(d => (
          <option key={d} value={d}>{d}</option>
        ))}
      </select>
    </div>
  );
}
