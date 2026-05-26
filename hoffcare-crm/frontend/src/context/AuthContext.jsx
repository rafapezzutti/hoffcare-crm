import { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem('psaude_user');
    return stored ? JSON.parse(stored) : null;
  });

  // Ao montar, atualiza o usuário via /me para garantir campos atualizados (ex: is_autonomous)
  useEffect(() => {
    const token = localStorage.getItem('psaude_token');
    if (!token) return;
    api.get('/auth/me').then(res => {
      const fresh = res.data;
      localStorage.setItem('psaude_user', JSON.stringify(fresh));
      setUser(fresh);
    }).catch(() => {
      // Token expirado ou inválido — não faz nada, ProtectedRoute vai redirecionar
    });
  }, []);

  const login = async (email, password) => {
    const res = await api.post('/auth/login', { email, password });
    localStorage.setItem('psaude_token', res.data.token);
    localStorage.setItem('psaude_user', JSON.stringify(res.data.user));
    // Admin sempre começa sem clínica selecionada
    if (res.data.user.role === 'admin') {
      localStorage.removeItem('psaude_clinic');
    }
    setUser(res.data.user);
    return res.data.user;
  };

  const logout = () => {
    localStorage.removeItem('psaude_token');
    localStorage.removeItem('psaude_user');
    localStorage.removeItem('psaude_clinic');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
