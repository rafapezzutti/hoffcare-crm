import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';
import i18n from '../i18n/index.js';

const LANGS = [
  { code: 'pt', label: 'Português', flag: '🇧🇷' },
  { code: 'en', label: 'English',   flag: '🇺🇸' },
  { code: 'es', label: 'Español',   flag: '🇪🇸' },
];

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [lang, setLang] = useState(localStorage.getItem('psaude_lang') || 'pt');

  const handleLang = (code) => {
    setLang(code);
    i18n.changeLanguage(code);
    localStorage.setItem('psaude_lang', code);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || t('login.errorDefault'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">

        {/* Seletor de idioma */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 10, marginBottom: 20 }}>
          {LANGS.map(l => (
            <button
              key={l.code}
              onClick={() => handleLang(l.code)}
              title={l.label}
              style={{
                background: lang === l.code ? 'var(--blue)' : 'var(--gray-100)',
                border: lang === l.code ? '2px solid var(--blue)' : '2px solid transparent',
                borderRadius: 8,
                padding: '6px 12px',
                fontSize: 22,
                cursor: 'pointer',
                transition: 'all 0.15s',
                opacity: lang === l.code ? 1 : 0.55,
                transform: lang === l.code ? 'scale(1.15)' : 'scale(1)',
              }}
            >
              {l.flag}
            </button>
          ))}
        </div>

        <div className="login-logo">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14 }}>
            <svg width="52" height="52" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="38" y="10" width="24" height="80" rx="8" fill="#4DB8E8"/>
              <rect x="10" y="38" width="80" height="24" rx="8" fill="#4DB8E8"/>
              <rect x="42" y="14" width="16" height="72" rx="6" fill="#E8841A" opacity="0.7"/>
              <rect x="14" y="42" width="72" height="16" rx="6" fill="#E8841A" opacity="0.7"/>
              <circle cx="50" cy="50" r="10" fill="white"/>
              <circle cx="50" cy="50" r="6" fill="#4DB8E8"/>
            </svg>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#4DB8E8', lineHeight: 1.1, letterSpacing: 0.5 }}>P. Soluções</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#E8841A', lineHeight: 1.2, letterSpacing: 1 }}>para Saúde</div>
            </div>
          </div>
          <p style={{ marginTop: 10, fontSize: 11, color: '#adb5bd', letterSpacing: 2 }}>{t('login.system')}</p>
          <h1 style={{ marginTop: 16, fontSize: 15, fontWeight: 600, color: '#495057' }}>{t('login.accessAccount')}</h1>
        </div>

        {error && <div className="alert alert-error"><i className="fas fa-circle-exclamation" /> {error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">{t('login.email')}</label>
            <input
              className="form-control"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder={t('login.emailPlaceholder')}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">{t('login.password')}</label>
            <div style={{ position: 'relative' }}>
              <input
                className="form-control"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                style={{ paddingRight: 44 }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                style={{
                  position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: '#6c757d', fontSize: 15, padding: 4,
                }}
                tabIndex={-1}
              >
                <i className={`fas ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`} />
              </button>
            </div>
          </div>

          <button
            className="btn btn-primary btn-lg"
            type="submit"
            disabled={loading}
            style={{ width: '100%', justifyContent: 'center', marginTop: 8 }}
          >
            {loading
              ? <><span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> {t('login.entering')}</>
              : <><i className="fas fa-right-to-bracket" /> {t('login.enter')}</>
            }
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <button
            onClick={() => navigate('/forgot-password')}
            style={{ background: 'none', border: 'none', color: '#4DB8E8', cursor: 'pointer', fontSize: 13 }}
          >
            {t('login.forgotPassword')}
          </button>
        </div>

        <div className="login-powered">{t('login.poweredBy')}</div>
      </div>
    </div>
  );
}
