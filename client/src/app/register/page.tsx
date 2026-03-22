'use client';
import { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { TrendingUp, Eye, EyeOff } from 'lucide-react';

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
    try {
      await register(username, email, password);
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const inp: React.CSSProperties = {
    width: '100%', padding: '11px 14px', borderRadius: 10,
    background: '#111827', border: '1px solid #1e2d45',
    color: '#e2e8f0', fontFamily: 'monospace', fontSize: 13, outline: 'none',
  };

  return (
    <div style={{ minHeight: '100vh', background: '#0a0e1a', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 400 }}>

        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            width: 52, height: 52, background: '#00d4aa', borderRadius: 14,
            display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px',
          }}>
            <TrendingUp size={26} color="#0a0e1a"/>
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#e2e8f0', marginBottom: 4 }}>NEPSE Dashboard</div>
          <div style={{ fontSize: 12, color: '#94a3b8', fontFamily: 'monospace' }}>5th Sem DBMS Project</div>
        </div>

        <div style={{ background: '#161d2e', border: '1px solid #1e2d45', borderRadius: 16, padding: 28 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#e2e8f0', marginBottom: 4 }}>Create account</div>
          <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 22, fontFamily: 'monospace' }}>
            Start tracking NEPSE stocks today
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={{ fontSize: 11, color: '#94a3b8', fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '.06em', display: 'block', marginBottom: 6 }}>
                Full name
              </label>
              <input style={inp} value={username} onChange={e => setUsername(e.target.value)}
                placeholder="Aarav Sharma" required minLength={2}/>
            </div>
            <div>
              <label style={{ fontSize: 11, color: '#94a3b8', fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '.06em', display: 'block', marginBottom: 6 }}>
                Email
              </label>
              <input style={inp} type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com" required/>
            </div>
            <div>
              <label style={{ fontSize: 11, color: '#94a3b8', fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '.06em', display: 'block', marginBottom: 6 }}>
                Password
              </label>
              <div style={{ position: 'relative' }}>
                <input style={{ ...inp, paddingRight: 42 }}
                  type={showPw ? 'text' : 'password'} value={password}
                  onChange={e => setPassword(e.target.value)} placeholder="min 6 characters" required minLength={6}/>
                <button type="button" onClick={() => setShowPw(!showPw)} style={{
                  position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: 0,
                }}>
                  {showPw ? <EyeOff size={14}/> : <Eye size={14}/>}
                </button>
              </div>
            </div>

            {error && (
              <div style={{ padding: '9px 12px', borderRadius: 8, fontSize: 12, fontFamily: 'monospace', background: 'rgba(255,77,109,.1)', border: '1px solid rgba(255,77,109,.3)', color: '#ff4d6d' }}>
                {error}
              </div>
            )}

            <button type="submit" disabled={loading} style={{
              padding: '12px', borderRadius: 10, border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
              background: '#00d4aa', color: '#0a0e1a', fontWeight: 700, fontSize: 13,
              fontFamily: 'inherit', opacity: loading ? .7 : 1, marginTop: 4,
            }}>
              {loading ? 'Creating account…' : 'Create account →'}
            </button>
          </form>

          <div style={{ textAlign: 'center', marginTop: 20, fontSize: 12, color: '#94a3b8', fontFamily: 'monospace' }}>
            Already have an account?{' '}
            <Link href="/login" style={{ color: '#00d4aa', textDecoration: 'none', fontWeight: 600 }}>
              Sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
