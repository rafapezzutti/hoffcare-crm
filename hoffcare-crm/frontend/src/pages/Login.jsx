import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao fazer login');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14 }}>
            <svg width="48" height="48" viewBox="0 0 100 100" fill="none">
              <path d="M50 15 C35 5, 10 20, 15 40 C20 55, 35 55, 50 70 C65 55, 80 55, 85 40 C90 20, 65 5, 50 15Z" stroke="#E8841A" strokeWidth="5" fill="none"/>
              <path d="M30 50 C20 65, 20 85, 35 88 C42 90, 50 80, 50 70" stroke="#E8841A" strokeWidth="5" fill="none" strokeLinecap="round"/>
              <path d="M70 50 C80 65, 80 85, 65 88 C58 90, 50 80, 50 70" stroke="#E8841A" strokeWidth="5" fill="none" strokeLinecap="round"/>
              <circle cx="50" cy="50" r="6" fill="#E8841A"/>
            </svg>
            <div>
              <div style={{ fontSize: 28, fontWeight: 800, color: '#4DB8E8', lineHeight: 1, letterSpacing: 2 }}>HOFF</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: '#E8841A', lineHeight: 1, letterSpacing: 2 }}>CARE</div>
            </div>
          </div>
          <p style={{ marginTop: 8, fontSize: 11, color: '#adb5bd', letterSpacing: 3 }}>clínica & odonto</p>
          <h1 style={{ marginTop: 20, fontSize: 16, fontWeight: 600, color: '#495057' }}>CRM — Sistema de Gestão</h1>
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
            <input
              className="form-control"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>
          <button className="btn btn-primary btn-lg" type="submit" disabled={loading} style={{ width: '100%', justifyContent: 'center', marginTop: 8 }}>
            {loading ? <><span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> Entrando...</> : <><i className="fas fa-right-to-bracket" /> Entrar</>}
          </button>
        </form>

        <div className="login-powered">powered by P. Soluções</div>
      </div>
    </div>
  );
}
