import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

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
  { to: '/records/new', icon: 'fa-file-medical', label: 'Novo Registro' },
  { to: '/records', icon: 'fa-clipboard-list', label: 'Registros' },
  { to: '/history', icon: 'fa-clock-rotate-left', label: 'Histórico de Pacientes' },
];

const adminItems = [
  { section: 'Administração' },
  { to: '/clinics', icon: 'fa-hospital', label: 'Consultórios' },
  { to: '/users', icon: 'fa-users-gear', label: 'Usuários' },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => { logout(); navigate('/login'); };

  const initials = user?.name?.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase();

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
        <div className="sidebar-logo">
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: 20, fontWeight: 700, color: '#4DB8E8', letterSpacing: 1 }}>HOFF</span>
            <span style={{ fontSize: 20, fontWeight: 700, color: '#E8841A', marginTop: -6, letterSpacing: 1 }}>CARE</span>
          </div>
          <div>
            <span style={{ display: 'block', fontSize: 9, color: '#6c757d', letterSpacing: 2 }}>clínica & odonto</span>
          </div>
        </div>
        <div className="sidebar-powered">powered by P. Soluções</div>

        <nav className="sidebar-nav">
          {navItems.map(renderNavItem)}
          {user?.role === 'admin' && adminItems.map(renderNavItem)}
        </nav>

        <div className="sidebar-bottom">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#E8841A', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700 }}>
              {initials}
            </div>
            <div>
              <div style={{ fontSize: 12, color: '#dee2e6', fontWeight: 500 }}>{user?.name}</div>
              <div style={{ fontSize: 10, color: '#6c757d', textTransform: 'capitalize' }}>{user?.role}</div>
            </div>
          </div>
          <button onClick={handleLogout} className="sidebar-link" style={{ padding: '8px 0', color: '#dc3545' }}>
            <i className="fas fa-right-from-bracket" /> Sair
          </button>
        </div>
      </aside>

      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}
