import { Link } from 'react-router-dom'

export default function Landing() {
  return (
    <>
      <style>{`
        .landing { min-height: 100vh; position: relative; z-index: 1; overflow-x: hidden; }

        nav {
          position: fixed; top: 16px; left: 50%; transform: translateX(-50%);
          z-index: 100; display: flex; align-items: center; justify-content: space-between;
          padding: 12px 20px; width: calc(100% - 48px); max-width: 860px;
          background: rgba(255,255,255,0.6);
          backdrop-filter: blur(24px) saturate(180%);
          -webkit-backdrop-filter: blur(24px) saturate(180%);
          border: 1px solid rgba(255,255,255,0.9);
          border-radius: 100px;
          box-shadow: 0 4px 24px rgba(100,120,180,0.12), 0 1px 4px rgba(100,120,180,0.08);
        }
        .nav-logo {
          font-family: 'DM Serif Display', serif;
          font-size: 1.25rem; letter-spacing: 0.5px; color: #1a1d23;
        }
        .nav-logo span { color: #007AFF; }
        .nav-links { display: flex; align-items: center; gap: 10px; }
        .nav-link {
          color: #4a5568; font-size: 0.88rem; font-weight: 500;
          padding: 7px 16px; border-radius: 100px; transition: all 0.2s;
        }
        .nav-link:hover { background: rgba(0,122,255,0.08); color: #007AFF; }
        .nav-btn {
          background: #007AFF; color: #fff; padding: 8px 20px;
          border-radius: 100px; font-size: 0.85rem; font-weight: 600;
          transition: all 0.2s; box-shadow: 0 4px 12px rgba(0,122,255,0.3);
        }
        .nav-btn:hover { background: #0066dd; box-shadow: 0 6px 20px rgba(0,122,255,0.4); transform: translateY(-1px); }

        .hero {
          min-height: 100vh; display: flex; align-items: center;
          justify-content: center; text-align: center; padding: 140px 24px 80px;
          position: relative;
        }
        .hero-orb {
          position: absolute; width: 500px; height: 500px; border-radius: 50%;
          background: radial-gradient(circle, rgba(0,122,255,0.08) 0%, transparent 70%);
          top: 50%; left: 50%; transform: translate(-50%, -50%);
          pointer-events: none;
        }
        .hero-orb::before {
          content: ''; position: absolute; inset: 30px; border-radius: 50%;
          border: 1px solid rgba(0,122,255,0.12);
          animation: spin 16s linear infinite;
        }
        .hero-orb::after {
          content: ''; position: absolute; inset: 80px; border-radius: 50%;
          border: 1px dashed rgba(0,122,255,0.08);
          animation: spin 24s linear infinite reverse;
        }
        .hero-content { position: relative; z-index: 1; }
        .hero-badge {
          display: inline-flex; align-items: center; gap: 6px;
          background: rgba(0,122,255,0.08); border: 1px solid rgba(0,122,255,0.2);
          backdrop-filter: blur(12px); border-radius: 100px;
          padding: 6px 16px; font-size: 0.78rem; font-weight: 500;
          color: #007AFF; margin-bottom: 28px; letter-spacing: 0.3px;
        }
        .hero-badge::before { content: '●'; font-size: 0.5rem; animation: pulse 2s infinite; }
        .hero h1 {
          font-family: 'DM Serif Display', serif;
          font-size: clamp(3.5rem, 10vw, 6.5rem);
          color: #1a1d23; line-height: 1.05; letter-spacing: -1px;
          margin-bottom: 12px;
        }
        .hero h1 span { color: #007AFF; }
        .hero-sub {
          font-size: clamp(1rem, 2vw, 1.15rem); color: #4a5568;
          max-width: 480px; margin: 0 auto 40px; line-height: 1.7; font-weight: 400;
        }
        .hero-cta { display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; }
        .cta-primary {
          display: inline-block;
          background: #007AFF; color: #fff; padding: 15px 36px;
          border-radius: 100px; font-size: 0.92rem; font-weight: 600;
          box-shadow: 0 8px 30px rgba(0,122,255,0.35); transition: all 0.25s;
        }
        .cta-primary:hover { transform: translateY(-2px); box-shadow: 0 12px 40px rgba(0,122,255,0.45); }
        .cta-secondary {
          display: inline-block;
          background: rgba(255,255,255,0.65); color: #1a1d23; padding: 15px 36px;
          border-radius: 100px; font-size: 0.92rem; font-weight: 500;
          border: 1px solid rgba(255,255,255,0.9);
          backdrop-filter: blur(12px); transition: all 0.25s;
          box-shadow: 0 4px 16px rgba(100,120,180,0.1);
        }
        .cta-secondary:hover { background: rgba(255,255,255,0.85); transform: translateY(-2px); }

        .features {
          position: relative; z-index: 1;
          padding: 80px 24px; text-align: center;
        }
        .features-label {
          font-size: 0.75rem; font-weight: 600; letter-spacing: 1.5px;
          text-transform: uppercase; color: #007AFF; margin-bottom: 16px;
        }
        .features h2 {
          font-family: 'DM Serif Display', serif;
          font-size: clamp(1.8rem, 4vw, 2.8rem);
          color: #1a1d23; margin-bottom: 56px; font-weight: 400;
        }
        .features-grid {
          display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 16px; max-width: 920px; margin: 0 auto;
        }
        .feature-card {
          background: rgba(255,255,255,0.55);
          backdrop-filter: blur(20px) saturate(180%);
          -webkit-backdrop-filter: blur(20px) saturate(180%);
          border: 1px solid rgba(255,255,255,0.85);
          border-radius: 24px; padding: 32px 24px; text-align: left;
          box-shadow: 0 4px 24px rgba(100,120,180,0.08);
          transition: all 0.3s; cursor: default;
        }
        .feature-card:hover {
          transform: translateY(-6px);
          box-shadow: 0 16px 48px rgba(100,120,180,0.15);
          background: rgba(255,255,255,0.72);
        }
        .feature-icon {
          width: 48px; height: 48px; border-radius: 14px;
          background: rgba(0,122,255,0.08); border: 1px solid rgba(0,122,255,0.15);
          display: flex; align-items: center; justify-content: center;
          font-size: 1.4rem; margin-bottom: 20px;
        }
        .feature-card h3 { font-size: 1rem; font-weight: 600; color: #1a1d23; margin-bottom: 8px; }
        .feature-card p { color: #4a5568; font-size: 0.85rem; line-height: 1.65; }

        .cta-section {
          position: relative; z-index: 1;
          padding: 80px 24px 100px; text-align: center;
        }
        .cta-glass {
          max-width: 600px; margin: 0 auto;
          background: rgba(255,255,255,0.55);
          backdrop-filter: blur(24px) saturate(180%);
          -webkit-backdrop-filter: blur(24px) saturate(180%);
          border: 1px solid rgba(255,255,255,0.9);
          border-radius: 32px; padding: 56px 48px;
          box-shadow: 0 8px 40px rgba(100,120,180,0.12);
        }
        .cta-glass h2 {
          font-family: 'DM Serif Display', serif;
          font-size: clamp(1.8rem, 4vw, 2.5rem);
          color: #1a1d23; margin-bottom: 12px; font-weight: 400;
        }
        .cta-glass p { color: #4a5568; margin-bottom: 32px; font-size: 0.95rem; }

        footer {
          position: relative; z-index: 1;
          text-align: center; padding: 24px;
          color: #8a95a8; font-size: 0.8rem;
          border-top: 1px solid rgba(255,255,255,0.6);
        }

        @media (max-width: 600px) {
          nav { width: calc(100% - 32px); top: 12px; padding: 10px 16px; }
          .cta-glass { padding: 36px 24px; }
          .features { padding: 60px 16px; }
        }
      `}</style>

      <div className="landing">
        <nav>
          <div className="nav-logo">Orion<span>.</span></div>
          <div className="nav-links">
            <Link to="/login" className="nav-link">Sign In</Link>
            <Link to="/signup" className="nav-btn">Get Started</Link>
          </div>
        </nav>

        <section className="hero">
          <div className="hero-orb" />
          <div className="hero-content">
            <div className="hero-badge">Powered by Llama 4 Scout</div>
            <h1>Meet <span>Orion</span></h1>
            <p className="hero-sub">Your intelligent AI assistant. Ask anything, analyse files, generate images, and get instant answers in any language.</p>
            <div className="hero-cta">
              <Link to="/signup" className="cta-primary">Start for free</Link>
              <Link to="/login" className="cta-secondary">Sign in</Link>
            </div>
          </div>
        </section>

        <section className="features">
          <div className="features-label">Everything you need</div>
          <h2>Intelligent. Fast. Always Learning.</h2>
          <div className="features-grid">
            {[
              { icon: '⚡', title: 'Lightning Fast', desc: 'Powered by Groq, Orion delivers near-instant responses with live streaming.' },
              { icon: '🧠', title: 'Remembers You', desc: 'Orion builds a memory of your preferences and context across conversations.' },
              { icon: '🌐', title: 'Web Search', desc: 'Auto-detects when to search the web for live news, prices, weather and more.' },
              { icon: '📎', title: 'File & Image AI', desc: 'Upload PDFs, docs, spreadsheets, and images. Orion reads and analyses them.' },
              { icon: '🎨', title: 'Image Generation', desc: 'Generate stunning images from text prompts using FLUX via Hugging Face.' },
              { icon: '🔒', title: 'Secure & Private', desc: 'Supabase Auth and row-level security keeps every conversation yours alone.' },
            ].map(f => (
              <div key={f.title} className="feature-card">
                <div className="feature-icon">{f.icon}</div>
                <h3>{f.title}</h3>
                <p>{f.desc}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="cta-section">
          <div className="cta-glass">
            <h2>Ready to explore?</h2>
            <p>Join users discovering the power of conversational AI</p>
            <Link to="/signup" className="cta-primary">Start chatting now</Link>
          </div>
        </section>

        <footer>Orion AI © 2025 · Built with React, Supabase & Groq</footer>
      </div>
    </>
  )
}