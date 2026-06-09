import { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { useClinic } from '../context/ClinicContext';
import api from '../services/api';

// Seções colapsáveis — estado salvo no localStorage
const STORAGE_KEY = 'sidebar_sections';
const DEFAULT_OPEN = { principal: false, atendimento: false, registros: false, estetica: false, estoque: false, orcamentos: false, financeiro: false, admin: false, ia: false };

function loadSections() {
  try { return { ...DEFAULT_OPEN, ...JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') }; }
  catch { return DEFAULT_OPEN; }
}

export default function Layout() {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const { clinics, selectedClinic, setSelectedClinic } = useClinic();
  const navigate = useNavigate();
  const [clinicOpen,  setClinicOpen]  = useState(false);
  const [sections,    setSections]    = useState(loadSections);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [finAlert,    setFinAlert]    = useState(null); // contas a receber em atraso

  useEffect(() => {
    // Checa uma vez ao carregar o sistema (controle de recebimento é manual)
    api.get('/receivables/summary')
      .then(r => setFinAlert(r.data?.tem_atraso ? r.data : null))
      .catch(() => {});
  }, []);

  const toggleSection = (key) => {
    setSections(prev => {
      const next = { ...prev, [key]: !prev[key] };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  };

  const handleLogout = () => { logout(); navigate('/login'); };
  const initials  = user?.name?.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase();
  const roleLabel = (role) => ({ admin: 'Master', responsavel: 'Responsável', user: 'Usuário', recepcionista: 'Recepcionista', profissional: 'Profissional' }[role] || role);

  const handleClinicChange = (clinic) => {
    setSelectedClinic(clinic);
    setClinicOpen(false);
    window.location.reload();
  };

  const autonomousHidden = ['/rooms'];

  // Renderiza um item de nav
  const NavItem = ({ to, icon, label, exact }) => {
    if (user?.is_autonomous && autonomousHidden.includes(to)) return null;
    return (
      <NavLink to={to} end={exact}
        className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
        onClick={() => setSidebarOpen(false)}>
        {icon.startsWith('fa-') ? <i className={`fas ${icon}`} /> : <span style={{ fontSize: 15 }}>{icon}</span>}
        {label}
      </NavLink>
    );
  };

  // Renderiza um grupo colapsável
  const Section = ({ sectionKey, label, icon, children }) => {
    const open = sections[sectionKey];
    return (
      <>
        <button onClick={() => toggleSection(sectionKey)} style={{
          width: '100%', background: 'none', border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '6px 16px', marginTop: 4,
          color: '#8899aa', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1,
        }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {icon && <i className={`fas ${icon}`} style={{ fontSize: 9 }} />}
            {label}
          </span>
          <i className={`fas fa-chevron-${open ? 'up' : 'down'}`} style={{ fontSize: 8, opacity: 0.6 }} />
        </button>
        {open && children}
      </>
    );
  };

  return (
    <div className="layout">
      {/* Overlay mobile — fecha sidebar ao clicar fora */}
      {sidebarOpen && (
        <div onClick={() => setSidebarOpen(false)} className="sidebar-overlay" />
      )}

      {/* Topbar mobile — hambúrguer + nome da clínica */}
      <div className="mobile-topbar">
        <button onClick={() => setSidebarOpen(o => !o)}
          style={{ background: 'none', border: 'none', color: '#1a2535', fontSize: 22, cursor: 'pointer', padding: '0 4px' }}>
          <i className="fas fa-bars" />
        </button>
        <span style={{ fontWeight: 700, fontSize: 15, color: '#1a2535' }}>
          {selectedClinic?.name || 'P. Saúde'}
        </span>
        <span style={{ fontSize: 13, color: '#666' }}>{user?.name?.split(' ')[0]}</span>
      </div>

      <aside className={`sidebar${sidebarOpen ? ' open' : ''}`}
        style={sidebarOpen ? { zIndex: 999 } : {}}>
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
            <div style={{ fontSize: 9, color: '#6c757d', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 }}>{t('nav.activeClinic')}</div>
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
                    {selectedClinic?.name || t('nav.selectClinic')}
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

        {/* ── Alerta financeiro (parcelas em atraso) ── */}
        {finAlert && (
          <button
            onClick={() => { navigate('/receivables'); setSidebarOpen(false); }}
            title="Questões financeiras requerem sua atenção"
            style={{
              display: 'flex', alignItems: 'center', gap: 8, width: 'calc(100% - 24px)',
              margin: '8px 12px 0', padding: '8px 12px', cursor: 'pointer',
              background: '#fef9c3', border: '1px solid #facc15', borderRadius: 8, textAlign: 'left',
            }}>
            <span style={{ fontSize: 16 }}>❓</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#854d0e', lineHeight: 1.3 }}>
              Questões financeiras requerem sua atenção
              <span style={{ display: 'block', fontWeight: 400, color: '#a16207' }}>
                {finAlert.parcelas_vencidas} parcela{finAlert.parcelas_vencidas > 1 ? 's' : ''} vencida{finAlert.parcelas_vencidas > 1 ? 's' : ''}
              </span>
            </span>
          </button>
        )}

        <nav className="sidebar-nav" style={{ marginTop: 4 }}>

          {/* ── Principal (sempre visível) ── */}
          <Section sectionKey="principal" label={t('nav.principal')} icon="fa-house">
            <NavItem to="/" icon="fa-house" label={t('nav.dashboard')} exact />
            <NavItem to="/calendar/daily" icon="fa-calendar-day" label={t('nav.dailyCalendar')} />
            <NavItem to="/calendar/monthly" icon="fa-calendar-alt" label={t('nav.monthlyCalendar')} />
          </Section>

          {/* ── Atendimento ── */}
          <Section sectionKey="atendimento" label={t('nav.atendimento')} icon="fa-stethoscope">
            <NavItem to="/records/new" icon="fa-file-medical" label={t('nav.newRecord')} />
            <NavItem to="/records" icon="fa-clipboard-list" label={t('nav.records')} />
            <NavItem to="/history" icon="fa-clock-rotate-left" label={t('nav.history')} />
          </Section>

          {/* ── Cadastros ── */}
          <Section sectionKey="registros" label={t('nav.registros')} icon="fa-folder-open">
            <NavItem to="/patients" icon="fa-user-injured" label={t('nav.patients')} />
            <NavItem to="/professionals" icon="fa-user-md" label={t('nav.professionals')} />
            <NavItem to="/employees" icon="fa-id-badge" label="Funcionários" />
            {!user?.is_autonomous && <NavItem to="/rooms" icon="fa-door-open" label={t('nav.rooms')} />}
            <NavItem to="/procedures" icon="fa-list-check" label={t('nav.procedures')} />
          </Section>

          {/* ── Estética ── */}
          <Section sectionKey="estetica" label={t('nav.aestheticsSection')} icon="fa-face-smile">
            <NavItem to="/aesthetics" icon="fa-face-smile" label={t('nav.aesthetics')} />
          </Section>

          {/* ── Estoque ── */}
          <Section sectionKey="estoque" label="Estoque" icon="fa-boxes-stacked">
            <NavItem to="/inventory" icon="fa-boxes-stacked" label="Controle de Estoque" />
          </Section>

          {/* ── Orçamentos ── */}
          <Section sectionKey="orcamentos" label="Orçamentos" icon="fa-file-invoice">
            <NavItem to="/budgets" icon="fa-file-invoice" label="Orçamentos" />
            <NavItem to="/budgets/new" icon="fa-plus" label="Novo Orçamento" />
          </Section>

          {/* ── Financeiro ── */}
          <Section sectionKey="financeiro" label={t('nav.financial')} icon="fa-dollar-sign">
            <NavItem to="/cash-flow" icon="fa-chart-line" label="Fluxo de Caixa" />
            <NavItem to="/receivables" icon="fa-hand-holding-dollar" label="Contas a Receber" />
            <NavItem to="/receipts" icon="fa-receipt" label="Recibos" />
            <NavItem to="/expenses" icon="fa-file-invoice-dollar" label="Despesas" />
            <NavItem to="/rentals" icon="fa-key" label={t('nav.rentals')} />
            <NavItem to="/settlements" icon="fa-handshake" label={t('nav.settlements')} />
            <NavItem to="/statement" icon="fa-file-invoice-dollar" label={t('nav.monthlyStatement')} />
            <NavItem to="/bank-statement" icon="fa-table-list" label={t('nav.bankStatement')} />
            <NavItem to="/message-counter" icon="fa-chart-bar" label={t('nav.messageCounter')} />
          </Section>

          {/* ── Admin (só Master) ── */}
          {user?.role === 'admin' && (
            <Section sectionKey="admin" label={t('nav.admin')} icon="fa-shield-halved">
              <NavItem to="/clinics" icon="fa-hospital" label={t('nav.clinics')} />
              <NavItem to="/users" icon="fa-users-gear" label={t('nav.users')} />
              <NavItem to="/permissions" icon="fa-shield-halved" label={t('nav.permissions')} />
              <NavItem to="/audit" icon="fa-clipboard-check" label="Auditoria" />
            </Section>
          )}

          {/* Responsável também pode gerenciar usuários da sua clínica */}
          {user?.role === 'responsavel' && (
            <Section sectionKey="admin" label="Configurações" icon="fa-gear">
              <NavItem to="/users" icon="fa-users-gear" label="Usuários" />
              <NavItem to="/permissions" icon="fa-shield-halved" label="Permissões" />
              <NavItem to="/audit" icon="fa-clipboard-check" label="Auditoria" />
            </Section>
          )}

          {/* ── IA — Talk to Me ── */}
          {(user?.can_use_ai_chat || user?.role === 'admin') && (
            <Section sectionKey="ia" label="IA" icon="fa-robot">
              <NavItem to="/ai-chat" icon="🤖" label="Talk to Me" />
            </Section>
          )}

        </nav>

        <div className="sidebar-bottom">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#E8841A', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
              {initials}
            </div>
            <div style={{ overflow: 'hidden' }}>
              <div style={{ fontSize: 12, color: '#dee2e6', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.name}</div>
              <div style={{ fontSize: 10, color: user?.is_trial ? '#f59e0b' : '#6c757d', textTransform: 'capitalize' }}>
                {user?.is_trial ? '⏳ Trial' : roleLabel(user?.role)}
              </div>
            </div>
          </div>
          <button onClick={handleLogout} className="sidebar-link" style={{ padding: '8px 0', color: '#dc3545' }}>
            <i className="fas fa-right-from-bracket" /> {t('nav.logout')}
          </button>
        </div>
      </aside>

      <main className="main-content">
        {/* Banner de aviso para usuários trial */}
        {user?.is_trial && (() => {
          const expires = user.trial_expires_at ? new Date(user.trial_expires_at) : null;
          const daysLeft = expires ? Math.max(0, Math.ceil((expires - new Date()) / 86400000)) : 0;
          const expired = expires && new Date() > expires;
          return (
            <div style={{
              background: expired ? '#fef2f2' : '#fffbeb',
              border: `1px solid ${expired ? '#fecaca' : '#fde68a'}`,
              borderRadius: 8, padding: '10px 16px', marginBottom: 16,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
              fontSize: 13,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <i className={`fas ${expired ? 'fa-circle-xmark' : 'fa-clock'}`}
                   style={{ color: expired ? '#dc3545' : '#f59e0b' }} />
                {expired
                  ? <span><strong>Período trial expirado.</strong> Seu acesso foi bloqueado. Entre em contato para contratar o plano.</span>
                  : <span><strong>Você está no período trial.</strong> Restam <strong>{daysLeft} dia{daysLeft !== 1 ? 's' : ''}</strong>. Envio de e-mail e WhatsApp bloqueados durante o trial.</span>
                }
              </div>
              {!expired && (
                <span style={{ fontSize: 11, color: '#92400e', whiteSpace: 'nowrap' }}>
                  Expira em {expires?.toLocaleDateString('pt-BR')}
                </span>
              )}
            </div>
          );
        })()}
        {user?.role === 'admin' && !selectedClinic ? (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            height: '80vh', gap: 20, textAlign: 'center',
          }}>
            <div style={{ fontSize: 64, color: 'var(--gray-200)' }}>
              <i className="fas fa-hospital" />
            </div>
            <h2 style={{ fontSize: 22, fontWeight: 700, color: 'var(--gray-700)' }}>
              {t('common.selectClinic')}
            </h2>
            <p style={{ color: 'var(--gray-500)', fontSize: 14, maxWidth: 340 }}>
              {t('common.selectClinicHint')}
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
