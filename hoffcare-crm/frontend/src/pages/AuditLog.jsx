import { useState, useEffect } from 'react';
import api from '../services/api';

const ACTIONS = {
  create: { label: 'Criação',   color: '#22c55e', icon: 'fa-plus' },
  update: { label: 'Edição',    color: '#f59e0b', icon: 'fa-pen' },
  delete: { label: 'Exclusão',  color: '#ef4444', icon: 'fa-trash' },
  login:  { label: 'Login',     color: '#3b82f6', icon: 'fa-right-to-bracket' },
};

const ENTITY_LABELS = {
  auth: 'Autenticação', users: 'Usuários', clinics: 'Clínicas',
  professionals: 'Profissionais', rooms: 'Salas', procedures: 'Procedimentos',
  patients: 'Pacientes', appointments: 'Agendamentos', records: 'Prontuários',
  autonomous: 'Autônomos', whatsapp: 'WhatsApp', rentals: 'Locações',
  settlements: 'Acertos', permissions: 'Permissões', 'message-log': 'Mensagens',
  aesthetics: 'Estética', 'before-after': 'Antes/Depois', anamnesis: 'Anamnese',
  anthropometry: 'Antropometria', reports: 'Relatórios', ocr: 'OCR',
  inventory: 'Estoque', budgets: 'Orçamentos', evolution: 'Evolução',
  odontogram: 'Odontograma', expenses: 'Despesas', 'cash-flow': 'Fluxo de Caixa',
  employees: 'Funcionários',
};

const PAGE_SIZE = 50;

function fmtDateTime(d) {
  return new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export default function AuditLog() {
  const [logs,    setLogs]    = useState([]);
  const [total,   setTotal]   = useState(0);
  const [page,    setPage]    = useState(0);
  const [loading, setLoading] = useState(true);
  const [denied,  setDenied]  = useState(false);
  const [expanded, setExpanded] = useState(null);

  const [filters, setFilters] = useState({ entities: [], users: [] });
  const [fAction, setFAction] = useState('');
  const [fEntity, setFEntity] = useState('');
  const [fUser,   setFUser]   = useState('');
  const [fFrom,   setFFrom]   = useState('');
  const [fTo,     setFTo]     = useState('');

  useEffect(() => {
    api.get('/audit/filters')
      .then(res => setFilters(res.data))
      .catch(err => { if (err.response?.status === 403) setDenied(true); });
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const params = { limit: PAGE_SIZE, offset: page * PAGE_SIZE };
      if (fAction) params.action    = fAction;
      if (fEntity) params.entity    = fEntity;
      if (fUser)   params.user_id   = fUser;
      if (fFrom)   params.date_from = fFrom;
      if (fTo)     params.date_to   = fTo;
      const res = await api.get('/audit', { params });
      setLogs(res.data.logs);
      setTotal(res.data.total);
    } catch (err) {
      if (err.response?.status === 403) setDenied(true);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [page, fAction, fEntity, fUser, fFrom, fTo]);
  useEffect(() => { setPage(0); }, [fAction, fEntity, fUser, fFrom, fTo]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  if (denied) {
    return (
      <div className="page">
        <div className="empty-state" style={{ marginTop: 80 }}>
          <i className="fas fa-shield-halved" />
          <p>Acesso restrito a administradores e responsáveis.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Log de Auditoria</h1>
          <p className="page-subtitle">Registro de todas as ações realizadas no sistema (LGPD)</p>
        </div>
        <button className="btn btn-outline" onClick={load}>
          <i className="fas fa-rotate" /> Atualizar
        </button>
      </div>

      {/* Filtros */}
      <div className="card" style={{ marginBottom: 16, padding: '14px 20px' }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <select className="form-control" style={{ width: 140 }} value={fAction} onChange={e => setFAction(e.target.value)}>
            <option value="">Todas ações</option>
            {Object.entries(ACTIONS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <select className="form-control" style={{ width: 180 }} value={fEntity} onChange={e => setFEntity(e.target.value)}>
            <option value="">Todos módulos</option>
            {filters.entities.map(en => <option key={en} value={en}>{ENTITY_LABELS[en] || en}</option>)}
          </select>
          <select className="form-control" style={{ width: 180 }} value={fUser} onChange={e => setFUser(e.target.value)}>
            <option value="">Todos usuários</option>
            {filters.users.map(u => <option key={u.user_id} value={u.user_id}>{u.user_name || `Usuário #${u.user_id}`}</option>)}
          </select>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <label style={{ fontSize: 12, color: 'var(--gray-500)' }}>De:</label>
            <input className="form-control" type="date" style={{ width: 145 }} value={fFrom} onChange={e => setFFrom(e.target.value)} />
            <label style={{ fontSize: 12, color: 'var(--gray-500)' }}>Até:</label>
            <input className="form-control" type="date" style={{ width: 145 }} value={fTo} onChange={e => setFTo(e.target.value)} />
          </div>
          <span style={{ fontSize: 12, color: 'var(--gray-500)', marginLeft: 'auto' }}>
            {total.toLocaleString('pt-BR')} registro{total === 1 ? '' : 's'}
          </span>
        </div>
      </div>

      {/* Tabela */}
      <div className="card">
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Data/Hora</th>
                <th>Usuário</th>
                <th>Ação</th>
                <th>Módulo</th>
                <th>Registro</th>
                <th>Status</th>
                <th>IP</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={8}>
                  <div className="empty-state"><i className="fas fa-spinner fa-spin" /><p>Carregando...</p></div>
                </td></tr>
              )}
              {!loading && logs.length === 0 && (
                <tr><td colSpan={8}>
                  <div className="empty-state">
                    <i className="fas fa-clipboard-check" />
                    <p>Nenhum registro de auditoria encontrado</p>
                  </div>
                </td></tr>
              )}
              {!loading && logs.map(log => {
                const act = ACTIONS[log.action] || { label: log.action, color: '#94a3b8', icon: 'fa-circle' };
                const ok  = log.status_code < 400;
                const isOpen = expanded === log.id;
                return [
                  <tr key={log.id} onClick={() => setExpanded(isOpen ? null : log.id)} style={{ cursor: 'pointer' }}>
                    <td style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{fmtDateTime(log.created_at)}</td>
                    <td style={{ fontSize: 13 }}>
                      {log.user_name || <span style={{ color: 'var(--gray-400)' }}>—</span>}
                      {log.user_role && <div style={{ fontSize: 10, color: 'var(--gray-500)', textTransform: 'capitalize' }}>{log.user_role}</div>}
                    </td>
                    <td>
                      <span style={{ fontSize: 11, fontWeight: 600, color: act.color, background: act.color + '18', padding: '3px 8px', borderRadius: 5, whiteSpace: 'nowrap' }}>
                        <i className={`fas ${act.icon}`} style={{ marginRight: 4, fontSize: 10 }} />{act.label}
                      </span>
                    </td>
                    <td style={{ fontSize: 13 }}>{ENTITY_LABELS[log.entity] || log.entity || '—'}</td>
                    <td style={{ fontSize: 12, color: 'var(--gray-500)' }}>{log.entity_id ? `#${log.entity_id}` : '—'}</td>
                    <td>
                      <span className={`badge ${ok ? 'badge-green' : 'badge-red'}`}>{log.status_code}</span>
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--gray-500)' }}>{log.ip || '—'}</td>
                    <td style={{ textAlign: 'right' }}>
                      <i className={`fas fa-chevron-${isOpen ? 'up' : 'down'}`} style={{ fontSize: 11, color: 'var(--gray-400)' }} />
                    </td>
                  </tr>,
                  isOpen && (
                    <tr key={`${log.id}-d`}>
                      <td colSpan={8} style={{ background: 'var(--gray-50, #f8fafc)', padding: '12px 20px' }}>
                        <div style={{ fontSize: 12, color: 'var(--gray-600)', marginBottom: 6 }}>
                          <strong>{log.method}</strong> {log.path}
                        </div>
                        {log.details && (
                          <pre style={{ fontSize: 11, background: '#0f172a', color: '#e2e8f0', padding: 12, borderRadius: 8, overflow: 'auto', maxHeight: 240, margin: 0 }}>
                            {JSON.stringify(log.details, null, 2)}
                          </pre>
                        )}
                        {log.user_agent && (
                          <div style={{ fontSize: 10, color: 'var(--gray-400)', marginTop: 6 }}>{log.user_agent}</div>
                        )}
                      </td>
                    </tr>
                  ),
                ];
              })}
            </tbody>
          </table>
        </div>

        {/* Paginação */}
        {total > PAGE_SIZE && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 20px', borderTop: '1px solid var(--gray-100, #f1f5f9)' }}>
            <button className="btn btn-outline btn-sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
              <i className="fas fa-chevron-left" /> Anterior
            </button>
            <span style={{ fontSize: 12, color: 'var(--gray-500)' }}>Página {page + 1} de {totalPages}</span>
            <button className="btn btn-outline btn-sm" disabled={page + 1 >= totalPages} onClick={() => setPage(p => p + 1)}>
              Próxima <i className="fas fa-chevron-right" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
