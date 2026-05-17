import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('As senhas não coincidem. Verifique e tente novamente.');
      return;
    }

    setLoading(true);
    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao fazer login. Verifique seu email e senha.');
    } finally {
      setLoading(false);
    }
  };

  const passwordsMatch = confirmPassword && password === confirmPassword;
  const passwordsMismatch = confirmPassword && password !== confirmPassword;

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
          <h1 style={{ marginTop: 16, fontSize: 15, fontWeight: 600, color: '#495057' }}>Acesse sua conta</h1>
        </div>

        {error && <div className="alert alert-error"><i className="fas fa-circle-exclamation" />{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Email</label>
            <input
              className="form-control"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="seu@email.com"
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Senha</label>
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

          <div className="form-group">
            <label className="form-label">
              Confirme a Senha
              {passwordsMatch && <span style={{ marginLeft: 8, color: '#28a745', fontSize: 11 }}><i className="fas fa-check-circle" /> Senhas iguais</span>}
              {passwordsMismatch && <span style={{ marginLeft: 8, color: '#dc3545', fontSize: 11 }}><i className="fas fa-times-circle" /> Senhas diferentes</span>}
            </label>
            <div style={{ position: 'relative' }}>
              <input
                className="form-control"
                type={showConfirm ? 'text' : 'password'}
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                required
                style={{
                  paddingRight: 44,
                  borderColor: passwordsMismatch ? '#dc3545' : passwordsMatch ? '#28a745' : undefined,
                }}
              />
              <button
                type="button"
                onClick={() => setShowConfirm(v => !v)}
                style={{
                  position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: '#6c757d', fontSize: 15, padding: 4,
                }}
                tabIndex={-1}
              >
                <i className={`fas ${showConfirm ? 'fa-eye-slash' : 'fa-eye'}`} />
              </button>
            </div>
          </div>

          <button
            className="btn btn-primary btn-lg"
            type="submit"
            disabled={loading || passwordsMismatch}
            style={{ width: '100%', justifyContent: 'center', marginTop: 8 }}
          >
            {loading
              ? <><span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> Entrando...</>
              : <><i className="fas fa-right-to-bracket" /> Entrar</>
            }
          </button>
        </form>

        <div className="login-powered">powered by P. Soluções</div>
      </div>
    </div>
  );
}
