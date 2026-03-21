'use client';
import { ReactNode } from 'react';

interface Props {
  label: string;
  value: string;
  sub?: string;
  icon?: ReactNode;
  accent?: string;
  delay?: number;
}

export default function StatCard({ label, value, sub, icon, accent = 'var(--accent)', delay = 0 }: Props) {
  return (
    <div
      className="card p-5 flex flex-col gap-2 animate-fadeUp relative overflow-hidden"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div
        className="absolute top-0 right-0 w-20 h-20 opacity-10 rounded-bl-full"
        style={{ background: accent }}
      />
      <div className="flex items-center justify-between">
        <span className="text-xs font-mono uppercase tracking-widest" style={{ color: 'var(--dim)' }}>
          {label}
        </span>
        {icon && <span style={{ color: accent }}>{icon}</span>}
      </div>
      <div className="text-2xl font-bold" style={{ color: accent, fontFamily: 'var(--font-mono)' }}>
        {value}
      </div>
      {sub && (
        <div className="text-xs" style={{ color: 'var(--dim)' }}>{sub}</div>
      )}
    </div>
  );
}
