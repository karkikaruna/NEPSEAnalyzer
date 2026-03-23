'use client';
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import CandlestickChart from '@/components/CandlestickChart';
import { fmt, fmtCr } from '@/lib/api';
import { Briefcase, Plus, Trash2, ChevronDown, ChevronUp, BarChart2, RefreshCw, TrendingUp, TrendingDown } from 'lucide-react';

interface Holding { symbol:string; kitta:number; buy_price:number; added_at:string; close_price:number|null; open_price:number|null; high_price:number|null; low_price:number|null; volume:number|null; turnover:number|null; trading_date:string|null; current_value:number; invested_amount:number; profit_loss:number; profit_loss_pct:number; }

export default function PortfolioPage() {
  const { user, token, loading:authLoading } = useAuth();
  const router = useRouter();
  const [holdings,  setHoldings]  = useState<Holding[]>([]);
  const [summary,   setSummary]   = useState<any>(null);
  const [symbols,   setSymbols]   = useState<string[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [removing,  setRemoving]  = useState<string|null>(null);
  const [expanded,  setExpanded]  = useState<Record<string,boolean>>({});
  const [date,      setDate]      = useState('');
  const [selSym,    setSelSym]    = useState('');
  const [kitta,     setKitta]     = useState('');
  const [buyPrice,  setBuyPrice]  = useState('');
  const [symSearch, setSymSearch] = useState('');
  const [dropOpen,  setDropOpen]  = useState(false);
  const [addMsg,    setAddMsg]    = useState('');
  const [addErr,    setAddErr]    = useState('');
  const [adding,    setAdding]    = useState(false);

  useEffect(()=>{ if(!authLoading&&!user) router.push('/login'); },[user,authLoading,router]);

  const load = useCallback(async()=>{
    if(!token) return; setLoading(true);
    try {
      const [pR,sR]=await Promise.all([
        fetch('/nepse/portfolio',{headers:{Authorization:`Bearer ${token}`}}).then(r=>r.json()),
        fetch('/nepse/symbols').then(r=>r.json()),
      ]);
      setHoldings(pR.data??[]); setSummary(pR.summary??null); setDate(pR.trading_date??'');
      setSymbols(sR.symbols??[]);
    } finally { setLoading(false); }
  },[token]);

  useEffect(()=>{ if(user) load(); },[user,load]);

  const addHolding=async(e:React.FormEvent)=>{
    e.preventDefault(); if(!selSym||!kitta||!buyPrice) return;
    setAdding(true); setAddMsg(''); setAddErr('');
    try {
      const res=await fetch('/nepse/portfolio',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify({symbol:selSym,kitta:parseInt(kitta),buy_price:parseFloat(buyPrice)})});
      const j=await res.json();
      if(!res.ok){setAddErr(j.detail??'Error');return;}
      setAddMsg(`${selSym} added!`); setSelSym(''); setKitta(''); setBuyPrice(''); setSymSearch('');
      load(); setTimeout(()=>setAddMsg(''),3000);
    } finally { setAdding(false); }
  };

  const remove=async(sym:string)=>{
    setRemoving(sym);
    await fetch(`/nepse/portfolio/${sym}`,{method:'DELETE',headers:{Authorization:`Bearer ${token}`}});
    setHoldings(h=>h.filter(x=>x.symbol!==sym)); setRemoving(null);
  };

  const filteredSyms=symbols.filter(s=>s.includes(symSearch.toUpperCase())).slice(0,50);
  if(authLoading||!user) return null;

  const plColor=(n:number)=>n>0?'#16a34a':n<0?'#dc2626':'#6b7280';
  const plBg=(n:number)=>n>0?'#dcfce7':n<0?'#fee2e2':'#f3f4f6';

  const inp=(type:string,val:string,set:(v:string)=>void,ph:string)=>(
    <input type={type} value={val} onChange={e=>set(e.target.value)} placeholder={ph}
      style={{width:'100%',padding:'9px 12px',borderRadius:8,border:'1.5px solid #e5e7eb',fontSize:13,color:'#111928',outline:'none',boxSizing:'border-box' as any,background:'#f9fafb',transition:'border .15s'}}
      onFocus={e=>e.target.style.border='1.5px solid #1a56db'}
      onBlur={e=>e.target.style.border='1.5px solid #e5e7eb'}/>
  );

  return (
    <div style={{display:'flex',minHeight:'100vh',background:'#f9fafb',fontFamily:"'Inter',system-ui,sans-serif"}}>
      <Sidebar/>
      <main style={{marginLeft:240,flex:1,padding:'24px 28px',overflowY:'auto'}}>

        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:24}}>
          <div>
            <h1 style={{fontSize:22,fontWeight:700,color:'#111928',marginBottom:4,display:'flex',alignItems:'center',gap:8}}>
              <Briefcase size={20} color="#1a56db"/> My Portfolio
            </h1>
            <div style={{fontSize:13,color:'#6b7280'}}>{holdings.length} holdings · {date||'—'}</div>
          </div>
          <button onClick={load} style={{display:'flex',alignItems:'center',gap:6,padding:'8px 14px',borderRadius:8,border:'1px solid #e5e7eb',background:'#fff',color:'#374151',fontSize:12,cursor:'pointer',fontFamily:'inherit'}}>
            <RefreshCw size={13}/> Refresh
          </button>
        </div>

        {summary&&holdings.length>0&&(
          <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12,marginBottom:20}}>
            {[
              {label:'Total Invested',  value:`₨ ${(summary.total_invested).toLocaleString('en-IN',{maximumFractionDigits:0})}`, color:'#374151',     bg:'#f9fafb'},
              {label:'Current Value',   value:`₨ ${(summary.total_current).toLocaleString('en-IN',{maximumFractionDigits:0})}`,  color:'#111928',     bg:'#f9fafb'},
              {label:'Total P&L',       value:`${summary.total_pl>=0?'+':''}₨ ${Math.abs(summary.total_pl).toLocaleString('en-IN',{maximumFractionDigits:0})}`, color:plColor(summary.total_pl), bg:plBg(summary.total_pl)},
              {label:'Return',          value:`${summary.total_pl_pct>=0?'+':''}${summary.total_pl_pct.toFixed(2)}%`,             color:plColor(summary.total_pl_pct), bg:plBg(summary.total_pl_pct)},
            ].map(c=>(
              <div key={c.label} style={{background:'#fff',border:'1px solid #e5e7eb',borderRadius:12,padding:'14px 16px'}}>
                <div style={{fontSize:12,color:'#6b7280',marginBottom:6}}>{c.label}</div>
                <div style={{fontSize:17,fontWeight:700,color:c.color}}>{c.value}</div>
              </div>
            ))}
          </div>
        )}

        <div style={{background:'#fff',border:'1px solid #e5e7eb',borderRadius:12,padding:'18px 20px',marginBottom:20}}>
          <div style={{fontSize:14,fontWeight:600,color:'#111928',marginBottom:14}}>Add Holding</div>
          <form onSubmit={addHolding} style={{display:'flex',gap:10,alignItems:'flex-end',flexWrap:'wrap'}}>

            <div style={{flex:'1',minWidth:180}}>
              <label style={{display:'block',fontSize:12,fontWeight:500,color:'#374151',marginBottom:5}}>Company</label>
              <div style={{position:'relative'}}>
                <div onClick={()=>setDropOpen(!dropOpen)}
                  style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'9px 12px',borderRadius:8,cursor:'pointer',background:'#f9fafb',border:'1.5px solid #e5e7eb',color:selSym?'#111928':'#9ca3af',fontSize:13,userSelect:'none'}}>
                  <span>{selSym||'Select symbol…'}</span>
                  <ChevronDown size={13} style={{color:'#9ca3af',transform:dropOpen?'rotate(180deg)':'none',transition:'.15s'}}/>
                </div>
                {dropOpen&&(
                  <div style={{position:'absolute',top:'calc(100% + 4px)',left:0,right:0,zIndex:100,background:'#fff',border:'1px solid #e5e7eb',borderRadius:8,maxHeight:200,overflow:'hidden',boxShadow:'0 4px 16px rgba(0,0,0,.1)'}}>
                    <div style={{padding:'7px 10px',borderBottom:'1px solid #f3f4f6'}}>
                      <input autoFocus value={symSearch} onChange={e=>setSymSearch(e.target.value.toUpperCase())} placeholder="Search…" onClick={e=>e.stopPropagation()}
                        style={{width:'100%',padding:'6px 10px',borderRadius:6,fontSize:12,background:'#f9fafb',border:'1px solid #e5e7eb',color:'#111928',outline:'none',boxSizing:'border-box' as any}}/>
                    </div>
                    <div style={{overflowY:'auto',maxHeight:160}}>
                      {filteredSyms.map(sym=>(
                        <div key={sym} onClick={()=>{setSelSym(sym);setDropOpen(false);setSymSearch('');}}
                          style={{padding:'7px 14px',fontSize:13,cursor:'pointer',color:sym===selSym?'#1a56db':'#374151',background:sym===selSym?'#eff6ff':'transparent',fontWeight:sym===selSym?600:400}}
                          onMouseEnter={e=>(e.currentTarget.style.background='#f9fafb')}
                          onMouseLeave={e=>(e.currentTarget.style.background=sym===selSym?'#eff6ff':'transparent')}>
                          {sym}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div style={{minWidth:110}}>
              <label style={{display:'block',fontSize:12,fontWeight:500,color:'#374151',marginBottom:5}}>Kitta</label>
              {inp('number',kitta,setKitta,'e.g. 100')}
            </div>
            <div style={{minWidth:140}}>
              <label style={{display:'block',fontSize:12,fontWeight:500,color:'#374151',marginBottom:5}}>Buy price (NPR)</label>
              {inp('number',buyPrice,setBuyPrice,'e.g. 1200')}
            </div>

            <button type="submit" disabled={!selSym||!kitta||!buyPrice||adding}
              style={{display:'flex',alignItems:'center',gap:6,padding:'9px 18px',borderRadius:8,border:'none',cursor:'pointer',background:'#1a56db',color:'#fff',fontWeight:600,fontSize:13,fontFamily:'inherit',whiteSpace:'nowrap',opacity:adding?.6:1}}>
              <Plus size={14}/>{adding?'Adding…':'Add Holding'}
            </button>

            {addMsg&&<span style={{fontSize:12,color:'#16a34a',fontWeight:500}}>✓ {addMsg}</span>}
            {addErr&&<span style={{fontSize:12,color:'#dc2626'}}>{addErr}</span>}
          </form>
        </div>

      
        {loading?<div style={{padding:40,textAlign:'center',color:'#6b7280',fontSize:13}}>Loading…</div>
        :holdings.length===0?(
          <div style={{padding:60,textAlign:'center',background:'#fff',border:'1px solid #e5e7eb',borderRadius:12}}>
            <Briefcase size={32} color="#e5e7eb" style={{marginBottom:12}}/>
            <div style={{fontWeight:600,color:'#111928',marginBottom:6}}>No holdings yet</div>
            <div style={{fontSize:13,color:'#6b7280'}}>Add a company above — enter symbol, kitta, and buy price</div>
          </div>
        ):(
          <div style={{display:'flex',flexDirection:'column',gap:8}}>
            {holdings.map(h=>{
              const pl=h.profit_loss; const plPct=h.profit_loss_pct;
              const open=expanded[h.symbol];
              const noData=h.close_price===null;
              return (
                <div key={h.symbol} style={{background:'#fff',border:`1px solid ${open?'#bfdbfe':'#e5e7eb'}`,borderRadius:12,overflow:'hidden'}}>
                  <div style={{padding:'14px 16px'}}>
                    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:12}}>

                      <div style={{display:'flex',alignItems:'center',gap:10}}>
                        <button onClick={()=>setExpanded(p=>({...p,[h.symbol]:!p[h.symbol]}))}
                          style={{display:'flex',alignItems:'center',gap:5,padding:'5px 8px',borderRadius:7,border:'1px solid',cursor:'pointer',fontSize:11,fontWeight:500,transition:'all .12s',
                            borderColor:open?'#bfdbfe':'#e5e7eb',background:open?'#eff6ff':'#f9fafb',color:open?'#1a56db':'#6b7280'}}>
                          <BarChart2 size={11}/>{open?<ChevronUp size={10}/>:<ChevronDown size={10}/>}
                        </button>
                        <div>
                          <div style={{fontWeight:700,fontSize:15,color:'#111928'}}>{h.symbol}</div>
                          <div style={{fontSize:11,color:'#9ca3af'}}>{h.kitta} kitta · bought @ ₨{fmt(h.buy_price)}</div>
                        </div>
                      </div>

                      <div style={{display:'flex',gap:20,alignItems:'center',flexWrap:'wrap'}}>
                        <div style={{textAlign:'right'}}>
                          <div style={{fontSize:10,color:'#9ca3af',marginBottom:2}}>Current LTP</div>
                          <div style={{fontSize:15,fontWeight:700,color:'#111928'}}>{noData?'—':fmt(h.close_price)}</div>
                        </div>
                        <div style={{textAlign:'right'}}>
                          <div style={{fontSize:10,color:'#9ca3af',marginBottom:2}}>Invested</div>
                          <div style={{fontSize:13,color:'#374151'}}>₨ {h.invested_amount.toLocaleString('en-IN',{maximumFractionDigits:0})}</div>
                        </div>
                        <div style={{textAlign:'right'}}>
                          <div style={{fontSize:10,color:'#9ca3af',marginBottom:2}}>Current value</div>
                          <div style={{fontSize:13,color:'#111928',fontWeight:600}}>₨ {h.current_value.toLocaleString('en-IN',{maximumFractionDigits:0})}</div>
                        </div>
                        <div style={{textAlign:'right'}}>
                          <div style={{fontSize:10,color:'#9ca3af',marginBottom:2}}>P&L</div>
                          <div style={{display:'inline-flex',alignItems:'center',gap:4,padding:'4px 10px',borderRadius:8,background:plBg(pl),color:plColor(pl),fontWeight:700,fontSize:13}}>
                            {pl>=0?<TrendingUp size={12}/>:<TrendingDown size={12}/>}
                            {pl>=0?'+':''}₨{Math.abs(pl).toLocaleString('en-IN',{maximumFractionDigits:0})}
                            <span style={{fontSize:11,opacity:.8}}>({plPct>=0?'+':''}{plPct.toFixed(2)}%)</span>
                          </div>
                        </div>
                        <button onClick={()=>remove(h.symbol)} disabled={removing===h.symbol}
                          style={{display:'flex',alignItems:'center',gap:4,padding:'6px 10px',borderRadius:7,border:'1px solid #fecaca',background:'#fff',cursor:'pointer',color:'#dc2626',fontSize:11,opacity:removing===h.symbol?.5:1}}>
                          <Trash2 size={11}/>
                        </button>
                      </div>
                    </div>
                  </div>
                  {open&&(
                    <div style={{padding:'0 16px 16px',borderTop:'1px solid #f3f4f6'}}>
                      <div style={{paddingTop:14}}>
                        <div style={{fontSize:13,fontWeight:600,color:'#111928',marginBottom:10}}>{h.symbol} — Price history</div>
                        <CandlestickChart symbol={h.symbol} token={token??''}/>
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
