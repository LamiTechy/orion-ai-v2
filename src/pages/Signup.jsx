import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const s = `
  .auth-bg { min-height:100vh; display:flex; align-items:center; justify-content:center; padding:24px; position:relative; z-index:1; }
  .auth-card {
    width:100%; max-width:400px;
    background: rgba(255,255,255,0.62);
    backdrop-filter: blur(28px) saturate(200%);
    -webkit-backdrop-filter: blur(28px) saturate(200%);
    border: 1px solid rgba(255,255,255,0.92);
    border-radius: 28px; padding: 48px 40px;
    box-shadow: 0 20px 60px rgba(80,100,160,0.14), 0 4px 16px rgba(80,100,160,0.08);
    animation: floatIn 0.4s ease both;
  }
  @keyframes floatIn { from { opacity:0; transform:scale(0.97) translateY(8px); } to { opacity:1; transform:scale(1) translateY(0); } }
  .auth-logo { font-family:'DM Serif Display',serif; font-size:2rem; color:#1a1d23; text-align:center; margin-bottom:4px; }
  .auth-logo span { color:#007AFF; }
  .auth-sub { text-align:center; color:#8a95a8; font-size:0.88rem; margin-bottom:36px; }
  .auth-form { display:flex; flex-direction:column; gap:14px; }
  .field label { display:block; font-size:0.78rem; font-weight:600; color:#4a5568; margin-bottom:6px; letter-spacing:0.3px; text-transform:uppercase; }
  .field input {
    width:100%;
    background: rgba(255,255,255,0.6); backdrop-filter: blur(8px);
    border: 1px solid rgba(255,255,255,0.8); border-radius: 14px;
    color: #1a1d23; padding: 13px 16px;
    font-family: 'DM Sans', sans-serif; font-size: 0.92rem;
    transition: all 0.2s; outline: none;
    box-shadow: 0 2px 8px rgba(100,120,180,0.06);
  }
  .field input:focus {
    border-color: rgba(0,122,255,0.45); background: rgba(255,255,255,0.82);
    box-shadow: 0 0 0 4px rgba(0,122,255,0.08), 0 2px 8px rgba(100,120,180,0.06);
  }
  .field input::placeholder { color: #b0bac8; }
  .auth-btn {
    background: #007AFF; color: #fff; border: none;
    border-radius: 14px; padding: 14px;
    font-family: 'DM Sans', sans-serif; font-size: 0.92rem; font-weight: 600;
    cursor: pointer; transition: all 0.2s; margin-top: 4px;
    box-shadow: 0 6px 20px rgba(0,122,255,0.3);
  }
  .auth-btn:hover { background:#0066dd; box-shadow:0 8px 28px rgba(0,122,255,0.4); transform:translateY(-1px); }
  .auth-btn:disabled { opacity:0.55; cursor:not-allowed; transform:none; }
  .auth-error { background:rgba(255,59,48,0.08); border:1px solid rgba(255,59,48,0.2); border-radius:12px; padding:11px 14px; color:#cc2200; font-size:0.83rem; }
  .auth-success { background:rgba(52,199,89,0.08); border:1px solid rgba(52,199,89,0.25); border-radius:12px; padding:11px 14px; color:#1a7a35; font-size:0.83rem; }
  .auth-footer { text-align:center; margin-top:24px; color:#8a95a8; font-size:0.85rem; }
  .auth-footer a { color:#007AFF; font-weight:500; }
`

export default function Signup() {
  const { signUp } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return }
    setLoading(true)
    const { error: err, data } = await signUp(email, password)
    if (err) { setError(err.message); setLoading(false) }
    else if (data?.session) { navigate('/chat') }
    else { setSuccess('Account created! Check your email to confirm, then sign in.'); setLoading(false) }
  }

  return (
    <>
      <style>{s}</style>
      <div className="auth-bg">
        <div className="auth-card">
          <div className="auth-logo">Orion<span>.</span></div>
          <div className="auth-sub">Create your account</div>
          <form className="auth-form" onSubmit={handleSubmit}>
            {error && <div className="auth-error">{error}</div>}
            {success && <div className="auth-success">{success}</div>}
            <div className="field"><label>Email</label><input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com" required /></div>
            <div className="field"><label>Password</label><input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Min. 6 characters" required /></div>
            <button className="auth-btn" type="submit" disabled={loading}>{loading ? 'Creating account…' : 'Create account'}</button>
          </form>
          <div className="auth-footer">Already have an account? <Link to="/login">Sign in</Link></div>
        </div>
      </div>
    </>
  )
}