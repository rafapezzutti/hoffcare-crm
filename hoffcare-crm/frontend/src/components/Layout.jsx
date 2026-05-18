import { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useClinic } from '../context/ClinicContext';

const navItems = [
  { section: 'Principal' },
  { to: '/', icon: 'fa-house', label: 'Dashboard', exact: true },
  { to: '/calendar/daily', icon: 'fa-calendar-day', label: 'Agenda do Dia' },
  { to: '/calendar/monthly', icon: 'fa-calendar-alt', label: 'Calendário Mensal' },

  { section: 'Cadastros' },
  { to: '/patients', icon: 'fa-user-injured', label: 'Pacientes' },
  { to: '/professionals', icon: 'fa-user-md', label: 'Profissionais' },
  { to: '/rooms', icon: 'fa-door-open', label: 'Salas' },
  { to: '/procedures', icon: 'fa-list-check', label: 'Procedimentos' },

  { section: 'Atendimento' },
  { to: '/records/new', icon: 'fa-file-medical', label: 'Novo Prontuário' },
  { to: '/records', icon: 'fa-clipboard-list', label: 'Prontuários' },
  { to: '/history', icon: 'fa-clock-rotate-left', label: 'Histórico de Pacientes' },
];

const adminItems = [
  { section: 'Administração' },
  { to: '/clinics', icon: 'fa-hospital', label: 'Consultórios' },
  { to: '/users', icon: 'fa-users-gear', label: 'Usuários' },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const { clinics, selectedClinic, setSelectedClinic } = useClinic();
  const navigate = useNavigate();
  const [clinicOpen, setClinicOpen] = useState(false);

  const handleLogout = () => { logout(); navigate('/login'); };

  const initials = user?.name?.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase();

  const handleClinicChange = (clinic) => {
    setSelectedClinic(clinic);
    setClinicOpen(false);
    // Recarrega a página para aplicar o novo filtro de clínica
    window.location.reload();
  };

  const renderNavItem = (item, i) => {
    if (item.section) return <div key={i} className="sidebar-section">{item.section}</div>;
    return (
      <NavLink
        key={item.to}
        to={item.to}
        end={item.exact}
        className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
      >
        <i className={`fas ${item.icon}`} />
        {item.label}
      </NavLink>
    );
  };

  return (
    <div className="layout">
      <aside className="sidebar">
        {/* Logo P. Soluções para Saúde */}
        <div className="sidebar-logo" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 0, padding: '20px 16px 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <svg width="32" height="32" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="38" y="10" width="24" height="80" rx="8" fill="#4DB8E8"/>
              <rect x="10" y="38" width="80" height="24" rx="8" fill="#4DB8E8"/>
              <rect x="42" y="14" width="16" height="72" rx="6" fill="#E8841A" opacity="0.7"/>
              <rect x="14" y="42" width="72" height="16" rx="6" fill="#E8841A" opacity="0.7"/>
              <circle cx="50" cy="50" r="10" fill="#1a2535"/>
              <circle cx="50" cy="50" r="6" fill="#4DB8E8"/>
            </svg>
            <div>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#4DB8E8', lineHeight: 1.1, letterSpacing: 0.5 }}>P. Soluções</div>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#E8841A', letterSpacing: 0.5 }}>para Saúde</div>
            </div>
          </div>

          {/* Seletor de clínica */}
          <div style={{ marginTop: 12, marginBottom: 4, width: '100%', position: 'relative' }}>
            <div style={{ fontSize: 9, color: '#6c757d', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 }}>Clínica ativa</div>
            {user?.role === 'admin' && clinics.length > 1 ? (
              <>
                <button
                  onClick={() => setClinicOpen(o => !o)}
                  style={{
                    width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 6, padding: '6px 10px', color: '#dee2e6', fontSize: 12, fontWeight: 600,
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 130 }}>
                    <i className="fas fa-hospital" style={{ marginRight: 6, color: '#E8841A', fontSize: 10 }} />
                    {selectedClinic?.name || 'Selecionar...'}
                  </span>
                  <i className={`fas fa-chevron-${clinicOpen ? 'up' : 'down'}`} style={{ fontSize: 9, opacity: 0.6, flexShrink: 0 }} />
                </button>
                {clinicOpen && (
                  <div style={{
                    position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100,
                    background: '#1e2d3d', border: '1px solid rgba(255,255,255,0.15)',
                    borderRadius: 6, marginTop: 4, overflow: 'hidden', boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
                  }}>
                    {clinics.map(c => (
                      <button
                        key={c.id}
                        onClick={() => handleClinicChange(c)}
                        style={{
                          width: '100%', padding: '9px 12px', background: c.id === selectedClinic?.id ? 'rgba(77,184,232,0.15)' : 'transparent',
                          border: 'none', color: c.id === selectedClinic?.id ? '#4DB8E8' : '#dee2e6',
                          fontSize: 12, textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
                          borderBottom: '1px solid rgba(255,255,255,0.05)',
                        }}
                      >
                        {c.id === selectedClinic?.id && <i className="fas fa-check" style={{ fontSize: 10, color: '#4DB8E8' }} />}
                        {c.id !== selectedClinic?.id && <span style={{ width: 14 }} />}
                        {c.name}
                      </button>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div style={{ fontSize: 12, fontWeight: 600, color: '#dee2e6', padding: '5px 0' }}>
                <i className="fas fa-hospital" style={{ marginRight: 6, color: '#E8841A', fontSize: 10 }} />
                {selectedClinic?.name || '—'}
              </div>
            )}
          </div>
        </div>

        <nav className="sidebar-nav" style={{ marginTop: 8 }}>
          {navItems.map(renderNavItem)}
          {user?.role === 'admin' && adminItems.map(renderNavItem)}
        </nav>

        <div className="sidebar-bottom">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#E8841A', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
              {initials}
            </div>
            <div style={{ overflow: 'hidden' }}>
              <div style={{ fontSize: 12, color: '#dee2e6', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.name}</div>
              <div style={{ fontSize: 10, color: '#6c757d', textTransform: 'capitalize' }}>{user?.role}</div>
            </div>
          </div>
          <button onClick={handleLogout} className="sidebar-link" style={{ padding: '8px 0', color: '#dc3545' }}>
            <i className="fas fa-right-from-bracket" /> Sair
          </button>
        </div>
      </aside>

      <main className="main-content">
        {user?.role === 'admin' && !selectedClinic ? (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            height: '80vh', gap: 20, textAlign: 'center',
          }}>
            <div style={{ fontSize: 64, color: 'var(--gray-200)' }}>
              <i className="fas fa-hospital" />
            </div>
            <h2 style={{ fontSize: 22, fontWeight: 700, color: 'var(--gray-700)' }}>
              Selecione uma clínica para começar
            </h2>
            <p style={{ color: 'var(--gray-500)', fontSize: 14, maxWidth: 340 }}>
              Use o menu lateral para escolher a clínica que deseja gerenciar. Os dados serão carregados após a seleção.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8, width: 280 }}>
              {clinics.map(c => (
                <button
                  key={c.id}
                  className="btn btn-outline"
                  style={{ justifyContent: 'flex-start', gap: 10, padding: '12px 16px' }}
                  onClick={() => { setSelectedClinic(c); window.location.reload(); }}
                >
                  <i className="fas fa-hospital" style={{ color: 'var(--orange)' }} />
                  {c.name}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <Outlet />
        )}
      </main>
    </div>
  );
}
