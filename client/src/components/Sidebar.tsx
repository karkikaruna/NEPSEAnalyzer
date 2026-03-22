'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import { LayoutDashboard, Star, LogOut, TrendingUp, User, Briefcase } from 'lucide-react';

const NAV = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/portfolio', label: 'Portfolio',  icon: Briefcase },
  { href: '/watchlist', label: 'Watchlist',  icon: Star },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const router = useRouter();

  const handleLogout = () => { logout(); router.push('/login'); };

  return (
    <aside style={{
      width: 220, minHeight: '100vh', background: '#0d1117',
      borderRight: '1px solid #1e2d45', display: 'flex', flexDirection: 'column',
      position: 'fixed', left: 0, top: 0, zIndex: 40,
    }}>
      <div style={{ padding: '20px 18px 16px', borderBottom: '1px solid #1e2d45' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 34, height: 34, background: '#00d4aa', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <TrendingUp size={18} color="#0a0e1a"/>
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 13, color: '#e2e8f0' }}>NEPSE</div>
            <div style={{ fontSize: 10, color: '#94a3b8', fontFamily: 'monospace' }}>Dashboard</div>
          </div>
        </div>
      </div>

      <div style={{ padding: '14px 18px', borderBottom: '1px solid #1e2d45' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(0,212,170,.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(0,212,170,.3)' }}>
            <User size={14} color="#00d4aa"/>
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#e2e8f0' }}>{user?.username}</div>
            <div style={{ fontSize: 10, color: '#94a3b8', fontFamily: 'monospace', maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.email}</div>
          </div>
        </div>
      </div>

      <nav style={{ flex: 1, padding: '12px 10px' }}>
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link key={href} href={href} style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '9px 10px',
              borderRadius: 8, marginBottom: 4, textDecoration: 'none', fontSize: 13,
              fontWeight: active ? 600 : 400,
              background: active ? 'rgba(0,212,170,.12)' : 'transparent',
              color: active ? '#00d4aa' : '#94a3b8',
              border: active ? '1px solid rgba(0,212,170,.2)' : '1px solid transparent',
              transition: 'all .15s',
            }}>
              <Icon size={15}/>{label}
            </Link>
          );
        })}
      </nav>

      <div style={{ padding: '12px 10px', borderTop: '1px solid #1e2d45' }}>
        <button onClick={handleLogout} style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 10,
          padding: '9px 10px', borderRadius: 8, cursor: 'pointer',
          background: 'transparent', border: '1px solid transparent',
          color: '#94a3b8', fontSize: 13, fontFamily: 'inherit', transition: 'all .15s',
        }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,77,109,.1)'; (e.currentTarget as HTMLElement).style.color = '#ff4d6d'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = '#94a3b8'; }}>
          <LogOut size={15}/> Sign out
        </button>
      </div>
    </aside>
  );
}
