import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

export default function ForgotPassword() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api.post('/auth/forgot-password', { email });
      setSent(true);
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao processar solicitação. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
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
          <p style={{ marginTop: 10, fontSize: 11, color: '#adb5bd', letterSpacing: 2 }}>sistema de gestão clínica</p>
          <h1 style={{ marginTop: 16, fontSize: 15, fontWeight: 600, color: '#495057' }}>{t('forgotPassword.title')}</h1>
        </div>

        {sent ? (
          <div style={{ textAlign: 'center', padding: '8px 0 16px' }}>
            <div style={{ fontSize: 40, color: '#4DB8E8', marginBottom: 16 }}>
              <i className="fas fa-envelope-circle-check" />
            </div>
            <p style={{ fontSize: 14, color: '#495057', lineHeight: 1.6, marginBottom: 20 }}>
              Se o e-mail <strong>{email}</strong> estiver cadastrado, você receberá as instruções de redefinição em instantes.
            </p>
            <p style={{ fontSize: 12, color: '#868e96', marginBottom: 24 }}>
              Verifique também a pasta de spam.
            </p>
            <button className="btn btn-outline" onClick={() => navigate('/login')} style={{ width: '100%', justifyContent: 'center' }}>
              <i className="fas fa-arrow-left" /> {t('forgotPassword.backToLogin')}
            </button>
          </div>
        ) : (
          <>
            {error && <div className="alert alert-error"><i className="fas fa-circle-exclamation" /> {error}</div>}

            <p style={{ fontSize: 13, color: '#6c757d', marginBottom: 20, lineHeight: 1.5 }}>
              {t('forgotPassword.subtitle')}
            </p>

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">{t('forgotPassword.email')}</label>
                <input
                  className="form-control"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  required
                  autoComplete="email"
                />
              </div>

              <button
                className="btn btn-primary btn-lg"
                type="submit"
                disabled={loading}
                style={{ width: '100%', justifyContent: 'center', marginTop: 8 }}
              >
                {loading
                  ? <><span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> {t('forgotPassword.sending')}</>
                  : <><i className="fas fa-paper-plane" /> {t('forgotPassword.send')}</>
                }
              </button>
            </form>

            <div style={{ textAlign: 'center', marginTop: 20 }}>
              <button
                onClick={() => navigate('/login')}
                style={{ background: 'none', border: 'none', color: '#4DB8E8', cursor: 'pointer', fontSize: 13 }}
              >
                <i className="fas fa-arrow-left" style={{ marginRight: 6 }} />
                {t('forgotPassword.backToLogin')}
              </button>
            </div>
          </>
        )}

        <div className="login-powered">powered by P. Soluções</div>
      </div>
    </div>
  );
}
