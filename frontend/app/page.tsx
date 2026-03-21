'use client';
import { useState, useEffect, useCallback } from 'react';
import { Activity, Database, RefreshCw, TrendingUp, BarChart2, Layers } from 'lucide-react';
import StatCard      from '@/components/StatCard';
import StockTable    from '@/components/StockTable';
import GainersLosers from '@/components/GainersLosers';
import TurnoverChart from '@/components/TurnoverChart';
import BreadthChart  from '@/components/BreadthChart';
import DateSelector  from '@/components/DateSelector';
import TickerTape    from '@/components/TickerTape';
import { fmtCr, fmt } from '@/lib/api';

export default function Home() {
  const [dates,     setDates]     = useState<string[]>([]);
  const [date,      setDate]      = useState('');
  const [summary,   setSummary]   = useState<any>(null);
  const [gainers,   setGainers]   = useState<any[]>([]);
  const [losers,    setLosers]    = useState<any[]>([]);
  const [topStocks, setTopStocks] = useState<any[]>([]);
  const [ticker,    setTicker]    = useState<any[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [lastFetch, setLastFetch] = useState('');

  useEffect(() => {
    fetch('/api/dates')
      .then(r => r.json())
      .then(j => {
        setDates(j.dates ?? []);
        if (j.dates?.[0]) setDate(j.dates[0]);
      })
      .catch(() => setDates([]));
  }, []);
  const loadAll = useCallback(async (d: string) => {
    if (!d) return;
    setLoading(true);
    try {
      const [sumRes, gainRes, lossRes, topRes, tickRes] = await Promise.all([
        fetch(`/api/market-summary?trading_date=${d}`).then(r => r.json()),
        fetch(`/api/top-gainers?trading_date=${d}&limit=8`).then(r => r.json()),
        fetch(`/api/top-losers?trading_date=${d}&limit=8`).then(r => r.json()),
        fetch(`/api/sector-volume?trading_date=${d}`).then(r => r.json()),
        fetch(`/api/stocks?trading_date=${d}&sort_by=turnover&order=desc&limit=40`).then(r => r.json()),
      ]);
      setSummary(sumRes.summary ?? null);
      setGainers(gainRes.data  ?? []);
      setLosers(lossRes.data   ?? []);
      setTopStocks(topRes.data ?? []);
      setTicker(tickRes.data   ?? []);
      setLastFetch(new Date().toLocaleTimeString());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (date) loadAll(date); }, [date, loadAll]);

  const s = summary ?? {};

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>

      <header
        className="sticky top-0 z-50 flex items-center justify-between px-6 py-3"
        style={{ background: 'rgba(10,14,26,.92)', backdropFilter: 'blur(12px)', borderBottom: '1px solid var(--border)' }}
      >
        <div className="flex items-center gap-3">
          <div
            className="flex items-center justify-center w-9 h-9 rounded-lg"
            style={{ background: 'var(--accent)', color: 'var(--bg)' }}
          >
            <Activity size={18}/>
          </div>
          <div>
            <div className="font-bold text-lg leading-tight" style={{ fontFamily: 'var(--font-sans)' }}>
              NEPSE Dashboard
            </div>
            <div className="text-xs font-mono flex items-center gap-1" style={{ color: 'var(--dim)' }}>
              <span className="live-dot"/>Nepal Stock Exchange
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {lastFetch && (
            <span className="text-xs font-mono hidden sm:block" style={{ color: 'var(--dim)' }}>
              Updated {lastFetch}
            </span>
          )}
          <DateSelector dates={dates} selected={date} onChange={d => { setDate(d); }}/>
          <button
            onClick={() => loadAll(date)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-mono transition-all"
            style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text)' }}
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''}/>
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
      </header>
      <TickerTape stocks={ticker}/>
      <main className="px-4 sm:px-6 py-6 max-w-screen-2xl mx-auto flex flex-col gap-6">
        <div
          className="flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-mono"
          style={{ background: 'rgba(0,212,170,.06)', border: '1px solid rgba(0,212,170,.2)', color: 'var(--dim)' }}
        >
          <Database size={14} style={{ color: 'var(--accent)' }}/>
          <span>
            <strong style={{ color: 'var(--accent)' }}>DBMS Project</strong>
            {' '}— 5th Sem Computer Engineering &nbsp;|&nbsp;
            Stack: Python → MySQL → FastAPI → Next.js &nbsp;|&nbsp;
            Trading date: <strong style={{ color: 'var(--text)' }}>{date}</strong>
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <StatCard
            label="Symbols"
            value={s.total_symbols ?? '—'}
            icon={<Layers size={16}/>}
            delay={0}
          />
          <StatCard
            label="Total Volume"
            value={s.total_volume ? Number(s.total_volume).toLocaleString('en-IN') : '—'}
            icon={<BarChart2 size={16}/>}
            accent="var(--gold)"
            delay={50}
          />
          <StatCard
            label="Total Turnover"
            value={fmtCr(s.total_turnover)}
            icon={<Activity size={16}/>}
            accent="var(--gold)"
            delay={100}
          />
          <StatCard
            label="Avg Close"
            value={fmt(s.avg_close)}
            accent="var(--dim)"
            delay={150}
          />
          <StatCard
            label="Gainers"
            value={s.gainers ?? '—'}
            sub={`Losers: ${s.losers ?? '—'} · Flat: ${s.unchanged ?? '—'}`}
            accent="var(--green)"
            icon={<TrendingUp size={16}/>}
            delay={200}
          />
          <StatCard
            label="Market High"
            value={fmt(s.market_high)}
            sub={`Low: ${fmt(s.market_low)}`}
            accent="var(--red)"
            delay={250}
          />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <TurnoverChart data={topStocks}/>
          </div>
          <BreadthChart
            gainers={Number(s.gainers   ?? 0)}
            losers={Number(s.losers     ?? 0)}
            unchanged={Number(s.unchanged ?? 0)}
          />
        </div>
        <GainersLosers gainers={gainers} losers={losers}/>
        {date && <StockTable tradingDate={date}/>}
        <footer
          className="text-center text-xs font-mono py-4 mt-2"
          style={{ color: 'var(--muted)', borderTop: '1px solid var(--border)' }}
        >
          NEPSE Dashboard · DBMS Project · 5th Sem CE ·{' '}
          Data source: <a href="https://sharesansar.com" target="_blank" rel="noreferrer" style={{ color: 'var(--accent)' }}>Sharesansar</a>
        </footer>
      </main>
    </div>
  );
}

