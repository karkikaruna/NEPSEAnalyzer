'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { LayoutDashboard, Star, LogOut, TrendingUp, User, Briefcase, ChevronRight } from 'lucide-react';

const NAV = [
  { href:'/dashboard', label:'Dashboard',  icon:LayoutDashboard, desc:'Market overview' },
  { href:'/portfolio',  label:'Portfolio',  icon:Briefcase,       desc:'My holdings' },
  { href:'/watchlist',  label:'Watchlist',  icon:Star,            desc:'Tracked stocks' },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const router = useRouter();

  return (
    <aside style={{ width:240, minHeight:'100vh', background:'#fff', borderRight:'1px solid #e5e7eb', display:'flex', flexDirection:'column', position:'fixed', left:0, top:0, zIndex:40, fontFamily:"'Inter',system-ui,sans-serif" }}>

      <div style={{ padding:'20px 20px 16px', borderBottom:'1px solid #f3f4f6' }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ width:36, height:36, background:'#1a56db', borderRadius:9, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
            <TrendingUp size={18} color="#fff"/>
          </div>
          <div>
            <div style={{ fontWeight:700, fontSize:14, color:'#111928', letterSpacing:'-0.2px' }}>NEPSE Portal</div>
            <div style={{ fontSize:11, color:'#6b7280' }}>Stock Dashboard</div>
          </div>
        </div>
      </div>

      <div style={{ padding:'14px 16px', borderBottom:'1px solid #f3f4f6', margin:'0 8px' }}>
        <div style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 10px', borderRadius:10, background:'#f9fafb' }}>
          <div style={{ width:32, height:32, borderRadius:'50%', background:'#dbeafe', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
            <span style={{ fontSize:13, fontWeight:600, color:'#1a56db' }}>{user?.username?.[0]?.toUpperCase()}</span>
          </div>
          <div style={{ overflow:'hidden', flex:1 }}>
            <div style={{ fontSize:13, fontWeight:600, color:'#111928', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{user?.username}</div>
            <div style={{ fontSize:11, color:'#6b7280', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{user?.email}</div>
          </div>
        </div>
      </div>

      <nav style={{ flex:1, padding:'12px 8px' }}>
        <div style={{ fontSize:10, fontWeight:600, color:'#9ca3af', textTransform:'uppercase', letterSpacing:'.06em', padding:'0 10px', marginBottom:4 }}>Menu</div>
        {NAV.map(({ href, label, icon:Icon, desc }) => {
          const active = pathname === href;
          return (
            <Link key={href} href={href} style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 10px', borderRadius:9, marginBottom:2, textDecoration:'none', transition:'all .15s',
              background:active?'#eff6ff':'transparent', color:active?'#1a56db':'#374151', border:active?'1px solid #dbeafe':'1px solid transparent' }}>
              <div style={{ width:32, height:32, borderRadius:7, display:'flex', alignItems:'center', justifyContent:'center', background:active?'#dbeafe':'#f3f4f6', flexShrink:0 }}>
                <Icon size={15} color={active?'#1a56db':'#6b7280'}/>
              </div>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:13, fontWeight:active?600:400 }}>{label}</div>
                <div style={{ fontSize:11, color:'#9ca3af' }}>{desc}</div>
              </div>
              {active && <ChevronRight size={13} color="#1a56db"/>}
            </Link>
          );
        })}
      </nav>

      <div style={{ padding:'12px 8px', borderTop:'1px solid #f3f4f6' }}>
        <button onClick={()=>{ logout(); router.push('/login'); }}
          style={{ width:'100%', display:'flex', alignItems:'center', gap:10, padding:'9px 10px', borderRadius:9, cursor:'pointer', background:'transparent', border:'1px solid transparent', color:'#6b7280', fontSize:13, fontFamily:'inherit', transition:'all .15s' }}
          onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.background='#fef2f2';(e.currentTarget as HTMLElement).style.color='#dc2626';(e.currentTarget as HTMLElement).style.border='1px solid #fecaca';}}
          onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.background='transparent';(e.currentTarget as HTMLElement).style.color='#6b7280';(e.currentTarget as HTMLElement).style.border='1px solid transparent';}}>
          <div style={{ width:32, height:32, borderRadius:7, display:'flex', alignItems:'center', justifyContent:'center', background:'#f3f4f6', flexShrink:0 }}>
            <LogOut size={14} color="currentColor"/>
          </div>
          <span>Sign out</span>
        </button>
      </div>
    </aside>
  );
}
