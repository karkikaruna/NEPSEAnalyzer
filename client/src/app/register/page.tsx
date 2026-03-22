'use client';
import { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function RegisterPage() {
  const { register } = useAuth();
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [showPw,   setShowPw]   = useState(false);
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError(''); setLoading(true);
    try { await register(username, email, password); router.push('/dashboard'); }
    catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  };

  const inp = (type:string, val:string, set:(v:string)=>void, ph:string, extra?:any) => (
    <input type={type} value={val} onChange={e=>set(e.target.value)} placeholder={ph} required
      style={{ width:'100%', padding:'10px 14px', borderRadius:8, border:'1.5px solid #d1d5db', fontSize:14, color:'#111928', outline:'none', boxSizing:'border-box' as any, background:'#fff', transition:'border .15s', ...extra }}
      onFocus={e=>e.target.style.border='1.5px solid #1a56db'}
      onBlur={e=>e.target.style.border='1.5px solid #d1d5db'}
    />
  );

  return (
    <div style={{ minHeight:'100vh', background:'#f0f2f5', display:'flex', alignItems:'center', justifyContent:'center', padding:20, fontFamily:"'Inter',system-ui,sans-serif" }}>
      <div style={{ width:'100%', maxWidth:420 }}>
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
          <h1 style={{ fontSize:20, fontWeight:700, color:'#111928', marginBottom:6 }}>Create your account</h1>
          <p style={{ fontSize:13, color:'#6b7280', marginBottom:24 }}>Start tracking your NEPSE portfolio</p>

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom:16 }}>
              <label style={{ display:'block', fontSize:13, fontWeight:500, color:'#374151', marginBottom:6 }}>Full name</label>
              {inp('text', username, setUsername, 'Aarav Sharma')}
            </div>
            <div style={{ marginBottom:16 }}>
              <label style={{ display:'block', fontSize:13, fontWeight:500, color:'#374151', marginBottom:6 }}>Email address</label>
              {inp('email', email, setEmail, 'name@company.com')}
            </div>
            <div style={{ marginBottom:20 }}>
              <label style={{ display:'block', fontSize:13, fontWeight:500, color:'#374151', marginBottom:6 }}>Password</label>
              <div style={{ position:'relative' }}>
                {inp(showPw?'text':'password', password, setPassword, 'Min 6 characters', { paddingRight:42 })}
                <button type="button" onClick={()=>setShowPw(!showPw)}
                  style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:'#9ca3af', padding:0, display:'flex', alignItems:'center' }}>
                  <svg width="18" height="18" fill="none" viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" strokeWidth="2"/><circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2"/></svg>
                </button>
              </div>
            </div>

            {error && (
              <div style={{ padding:'10px 14px', borderRadius:8, background:'#fef2f2', border:'1px solid #fecaca', color:'#dc2626', fontSize:13, marginBottom:16 }}>
                {error}
              </div>
            )}

            <button type="submit" disabled={loading}
              style={{ width:'100%', padding:'11px', borderRadius:8, border:'none', cursor:loading?'not-allowed':'pointer', background:loading?'#93c5fd':'#1a56db', color:'#fff', fontWeight:600, fontSize:14, boxSizing:'border-box' as any }}>
              {loading ? 'Creating account…' : 'Create account'}
            </button>
          </form>

          <div style={{ textAlign:'center', marginTop:20, fontSize:13, color:'#6b7280' }}>
            Already have an account?{' '}
            <Link href="/login" style={{ color:'#1a56db', fontWeight:500, textDecoration:'none' }}>Sign in</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
