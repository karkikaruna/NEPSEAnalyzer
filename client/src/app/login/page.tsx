'use client';
import { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [showPw,   setShowPw]   = useState(false);
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError(''); setLoading(true);
    try { await login(email, password); router.push('/dashboard'); }
    catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  };

  return (
    <div style={{ minHeight:'100vh', background:'#f0f2f5', display:'flex', alignItems:'center', justifyContent:'center', padding:20, fontFamily:"'Inter',system-ui,sans-serif" }}>
      <div style={{ width:'100%', maxWidth:420 }}>

        {/* Logo */}
        <div style={{ textAlign:'center', marginBottom:28 }}>
          <div style={{ display:'inline-flex', alignItems:'center', gap:10, marginBottom:8 }}>
            <div style={{ width:40, height:40, background:'#1a56db', borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center' }}>
              <svg width="22" height="22" fill="none" viewBox="0 0 24 24"><path d="M3 17l5-5 4 4 9-9" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </div>
            <div style={{ fontSize:20, fontWeight:700, color:'#111928', letterSpacing:'-0.3px' }}>NEPSE Portal</div>
          </div>
          <div style={{ fontSize:13, color:'#6b7280' }}>Nepal Stock Exchange Dashboard</div>
        </div>

        <div style={{ background:'#fff', borderRadius:16, boxShadow:'0 1px 3px rgba(0,0,0,.08),0 8px 24px rgba(0,0,0,.06)', padding:'32px 32px 28px' }}>
          <h1 style={{ fontSize:20, fontWeight:700, color:'#111928', marginBottom:6, letterSpacing:'-0.2px' }}>Sign in to your account</h1>
          <p style={{ fontSize:13, color:'#6b7280', marginBottom:24 }}>Track your NEPSE portfolio and watchlist</p>

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom:16 }}>
              <label style={{ display:'block', fontSize:13, fontWeight:500, color:'#374151', marginBottom:6 }}>Email address</label>
              <input type="email" value={email} onChange={e=>setEmail(e.target.value)} required
                placeholder="name@company.com"
                style={{ width:'100%', padding:'10px 14px', borderRadius:8, border:'1.5px solid #d1d5db', fontSize:14, color:'#111928', outline:'none', boxSizing:'border-box', background:'#fff', transition:'border .15s' }}
                onFocus={e=>e.target.style.border='1.5px solid #1a56db'}
                onBlur={e=>e.target.style.border='1.5px solid #d1d5db'}
              />
            </div>

            <div style={{ marginBottom:20 }}>
              <label style={{ display:'block', fontSize:13, fontWeight:500, color:'#374151', marginBottom:6 }}>Password</label>
              <div style={{ position:'relative' }}>
                <input type={showPw?'text':'password'} value={password} onChange={e=>setPassword(e.target.value)} required
                  placeholder="••••••••"
                  style={{ width:'100%', padding:'10px 42px 10px 14px', borderRadius:8, border:'1.5px solid #d1d5db', fontSize:14, color:'#111928', outline:'none', boxSizing:'border-box', background:'#fff', transition:'border .15s' }}
                  onFocus={e=>e.target.style.border='1.5px solid #1a56db'}
                  onBlur={e=>e.target.style.border='1.5px solid #d1d5db'}
                />
                <button type="button" onClick={()=>setShowPw(!showPw)}
                  style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:'#9ca3af', padding:0, display:'flex', alignItems:'center' }}>
                  {showPw
                    ? <svg width="18" height="18" fill="none" viewBox="0 0 24 24"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24M1 1l22 22" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
                    : <svg width="18" height="18" fill="none" viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" strokeWidth="2"/><circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2"/></svg>
                  }
                </button>
              </div>
            </div>

            {error && (
              <div style={{ padding:'10px 14px', borderRadius:8, background:'#fef2f2', border:'1px solid #fecaca', color:'#dc2626', fontSize:13, marginBottom:16 }}>
                {error}
              </div>
            )}

            <button type="submit" disabled={loading}
              style={{ width:'100%', padding:'11px', borderRadius:8, border:'none', cursor:loading?'not-allowed':'pointer', background:loading?'#93c5fd':'#1a56db', color:'#fff', fontWeight:600, fontSize:14, transition:'background .15s', boxSizing:'border-box' }}>
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <div style={{ textAlign:'center', marginTop:20, fontSize:13, color:'#6b7280' }}>
            Don't have an account?{' '}
            <Link href="/register" style={{ color:'#1a56db', fontWeight:500, textDecoration:'none' }}>Create account</Link>
          </div>
        </div>

        <p style={{ textAlign:'center', marginTop:16, fontSize:12, color:'#9ca3af' }}>
          NEPSE Dashboard · 5th Sem DBMS Project
        </p>
      </div>
    </div>
  );
}
