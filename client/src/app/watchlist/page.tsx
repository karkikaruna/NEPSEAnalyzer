'use client';
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import CandlestickChart from '@/components/CandlestickChart';
import { fmt, fmtCr, changePct, changeColor } from '@/lib/api';
import { Star, Trash2, RefreshCw, ChevronDown, ChevronUp, BarChart2, ArrowUpRight, ArrowDownRight } from 'lucide-react';

interface WatchItem { symbol:string; added_at:string; open_price:number|null; high_price:number|null; low_price:number|null; close_price:number|null; volume:number|null; turnover:number|null; trading_date:string|null; }

export default function WatchlistPage() {
  const { user, token, loading:authLoading } = useAuth();
  const router = useRouter();
  const [items,    setItems]    = useState<WatchItem[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [removing, setRemoving] = useState<string|null>(null);
  const [date,     setDate]     = useState('');
  const [expanded, setExpanded] = useState<Record<string,boolean>>({});

  useEffect(()=>{ if(!authLoading&&!user) router.push('/login'); },[user,authLoading,router]);

  const load = useCallback(async()=>{
    if(!token) return; setLoading(true);
    try {
      const res=await fetch('/nepse/watchlist',{headers:{Authorization:`Bearer ${token}`}});
      const j=await res.json(); setItems(j.data??[]); setDate(j.trading_date??'');
    } finally { setLoading(false); }
  },[token]);

  useEffect(()=>{ if(user) load(); },[user,load]);

  const remove=async(sym:string)=>{
    setRemoving(sym);
    await fetch(`/nepse/watchlist/${sym}`,{method:'DELETE',headers:{Authorization:`Bearer ${token}`}});
    setItems(i=>i.filter(x=>x.symbol!==sym)); setRemoving(null);
  };

  if(authLoading||!user) return null;

  const withData=items.filter(i=>i.close_price!==null);
  const gains=withData.filter(i=>(i.close_price??0)>(i.open_price??0)).length;
  const losses=withData.filter(i=>(i.close_price??0)<(i.open_price??0)).length;

  return (
    <div style={{display:'flex',minHeight:'100vh',background:'#f9fafb',fontFamily:"'Inter',system-ui,sans-serif"}}>
      <Sidebar/>
      <main style={{marginLeft:240,flex:1,padding:'24px 28px',overflowY:'auto'}}>

        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:24}}>
          <div>
            <h1 style={{fontSize:22,fontWeight:700,color:'#111928',marginBottom:4,display:'flex',alignItems:'center',gap:8}}>
              <Star size={20} color="#f59e0b" fill="#f59e0b"/> My Watchlist
            </h1>
            <div style={{fontSize:13,color:'#6b7280'}}>{items.length} stocks tracked · {date||'—'}</div>
          </div>
          <button onClick={load} style={{display:'flex',alignItems:'center',gap:6,padding:'8px 14px',borderRadius:8,border:'1px solid #e5e7eb',background:'#fff',color:'#374151',fontSize:12,cursor:'pointer',fontFamily:'inherit'}}>
            <RefreshCw size={13}/> Refresh
          </button>
        </div>

        {items.length>0&&(
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12,marginBottom:20}}>
            {[
              {label:'Tracked',    value:String(items.length), color:'#1a56db', bg:'#eff6ff'},
              {label:'Gainers',    value:String(gains),        color:'#16a34a', bg:'#dcfce7'},
              {label:'Losers',     value:String(losses),       color:'#dc2626', bg:'#fee2e2'},
            ].map(c=>(
              <div key={c.label} style={{background:'#fff',border:'1px solid #e5e7eb',borderRadius:12,padding:'14px 16px'}}>
                <div style={{fontSize:12,color:'#6b7280',marginBottom:6}}>{c.label}</div>
                <div style={{fontSize:20,fontWeight:700,color:c.color}}>{c.value}</div>
              </div>
            ))}
          </div>
        )}

        {loading?(
          <div style={{padding:40,textAlign:'center',color:'#6b7280',fontSize:13}}>Loading…</div>
        ):items.length===0?(
          <div style={{padding:60,textAlign:'center',background:'#fff',border:'1px solid #e5e7eb',borderRadius:12}}>
            <Star size={32} color="#e5e7eb" fill="#e5e7eb" style={{marginBottom:12}}/>
            <div style={{fontWeight:600,color:'#111928',marginBottom:6}}>No stocks yet</div>
            <div style={{fontSize:13,color:'#6b7280'}}>Go to Dashboard → add companies from the dropdown</div>
          </div>
        ):(
          <div style={{display:'flex',flexDirection:'column',gap:8}}>
            {items.map(item=>{
              const pct=changePct(item.open_price??0,item.close_price??0);
              const col=changeColor(pct);
              const noData=item.close_price===null;
              const open=expanded[item.symbol];
              return (
                <div key={item.symbol} style={{background:'#fff',border:`1px solid ${open?'#bfdbfe':'#e5e7eb'}`,borderRadius:12,overflow:'hidden',transition:'border .15s'}}>
                  <div style={{display:'grid',gridTemplateColumns:'1fr repeat(6,auto)',alignItems:'center',padding:'14px 16px',gap:16}}>

                    <div style={{display:'flex',alignItems:'center',gap:10}}>
                      <button onClick={()=>setExpanded(p=>({...p,[item.symbol]:!p[item.symbol]}))}
                        style={{display:'flex',alignItems:'center',gap:5,padding:'5px 8px',borderRadius:7,border:'1px solid',cursor:'pointer',fontSize:11,fontWeight:500,transition:'all .12s',
                          borderColor:open?'#bfdbfe':'#e5e7eb', background:open?'#eff6ff':'#f9fafb', color:open?'#1a56db':'#6b7280'}}>
                        <BarChart2 size={11}/>{open?<ChevronUp size={10}/>:<ChevronDown size={10}/>}
                      </button>
                      <div>
                        <div style={{fontWeight:700,fontSize:14,color:'#111928'}}>{item.symbol}</div>
                        <div style={{fontSize:11,color:'#9ca3af'}}>Added {item.added_at?.slice(0,10)}</div>
                      </div>
                    </div>

                    {[
                      {label:'LTP',   value:noData?'—':fmt(item.close_price),                                         color:noData?'#9ca3af':'#111928'},
                      {label:'Change',value:noData?'—':`${pct>=0?'+':''}${pct.toFixed(2)}%`,                          color:noData?'#9ca3af':col},
                      {label:'Open',  value:fmt(item.open_price),                                                      color:'#374151'},
                      {label:'High',  value:fmt(item.high_price),                                                      color:'#16a34a'},
                      {label:'Low',   value:fmt(item.low_price),                                                       color:'#dc2626'},
                      {label:'Turnover',value:fmtCr(item.turnover),                                                   color:'#374151'},
                    ].map(f=>(
                      <div key={f.label} style={{textAlign:'right'}}>
                        <div style={{fontSize:10,color:'#9ca3af',marginBottom:2}}>{f.label}</div>
                        <div style={{fontSize:13,fontWeight:600,color:f.color}}>{f.value}</div>
                      </div>
                    ))}

                    <button onClick={()=>remove(item.symbol)} disabled={removing===item.symbol}
                      style={{display:'flex',alignItems:'center',gap:4,padding:'5px 9px',borderRadius:7,border:'1px solid #fecaca',background:'#fff',cursor:'pointer',color:'#dc2626',fontSize:11,opacity:removing===item.symbol?.5:1}}>
                      <Trash2 size={10}/>
                    </button>
                  </div>

                  {open&&(
                    <div style={{padding:'0 16px 16px',borderTop:'1px solid #f3f4f6'}}>
                      <div style={{paddingTop:14}}>
                        <div style={{fontSize:13,fontWeight:600,color:'#111928',marginBottom:10}}>{item.symbol} — Candlestick chart</div>
                        <CandlestickChart symbol={item.symbol} token={token??''}/>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
