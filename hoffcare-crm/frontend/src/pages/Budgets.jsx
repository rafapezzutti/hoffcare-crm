import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import dayjs from 'dayjs';

const STATUS_CONFIG = {
  rascunho:  { label: 'Rascunho',   bg: 'var(--gray-100)', color: 'var(--gray-600)',  border: 'var(--gray-300)' },
  enviado:   { label: 'Enviado',    bg: '#e3f2fd',         color: '#1565c0',          border: '#90caf9' },
  aguardando:{ label: 'Aguardando', bg: '#fff8e1',         color: '#e65100',          border: '#ffcc80' },
  aceito:    { label: 'Aceito',     bg: '#e8f5e9',         color: '#2e7d32',          border: '#a5d6a7' },
  declinado: { label: 'Declinado',  bg: '#ffeaea',         color: 'var(--danger)',    border: '#f48fb1' },
  expirado:  { label: 'Expirado',   bg: 'var(--gray-100)', color: 'var(--gray-500)',  border: 'var(--gray-300)' },
};

const STATUS_TABS = ['todos', 'rascunho', 'aguardando', 'aceito', 'declinado', 'expirado'];

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || { label: status, bg: 'var(--gray-100)', color: 'var(--gray-500)', border: 'var(--gray-300)' };
  return (
    <span style={{
      background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`,
      borderRadius: 4, padding: '2px 9px', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap',
    }}>
      {cfg.label}
    </span>
  );
}

function StatusDropdown({ budget, onStatusChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const options = Object.keys(STATUS_CONFIG).filter(s => s !== budget.status);

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        className="btn btn-outline btn-sm"
        onClick={() => setOpen(o => !o)}
        title="Alterar status"
        style={{ fontSize: 12 }}
      >
        <i className="fas fa-chevron-down" />
      </button>
      {open && (
        <div style={{
          position: 'absolute', right: 0, top: '100%', marginTop: 4,
          background: 'white', border: '1px solid var(--gray-200)',
          borderRadius: 6, boxShadow: 'var(--shadow)', zIndex: 50,
          minWidth: 140, overflow: 'hidden',
        }}>
          {options.map(s => {
            const cfg = STATUS_CONFIG[s];
            return (
              <button
                key={s}
                onClick={() => { onStatusChange(budget.id, s); setOpen(false); }}
                style={{
                  display: 'block', width: '100%', textAlign: 'left',
                  padding: '8px 14px', border: 'none', background: 'none',
                  cursor: 'pointer', fontSize: 12, fontWeight: 600,
                  color: cfg.color,
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--gray-50)'}
                onMouseLeave={e => e.currentTarget.style.background = 'none'}
              >
                {cfg.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function Budgets() {
  const navigate = useNavigate();
  const [budgets, setBudgets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusTab, setStatusTab] = useState('todos');

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get('/budgets');
      setBudgets(res.data);
    } catch {
      setError('Erro ao carregar orçamentos.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = statusTab === 'todos'
    ? budgets
    : budgets.filter(b => b.status === statusTab);

  const countByStatus = (status) =>
    status === 'todos' ? budgets.length : budgets.filter(b => b.status === status).length;

  const handleStatusChange = async (id, status) => {
    try {
      await api.put(`/budgets/${id}/status`, { status });
      setBudgets(prev => prev.map(b => b.id === id ? { ...b, status } : b));
    } catch {
      alert('Erro ao atualizar status.');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Excluir este orçamento permanentemente?')) return;
    try {
      await api.delete(`/budgets/${id}`);
      setBudgets(prev => prev.filter(b => b.id !== id));
    } catch {
      alert('Erro ao excluir orçamento.');
    }
  };

  const fmtDate = (d) => d ? dayjs(d).format('DD/MM/YYYY') : '—';
  const fmtMoney = (v) => parseFloat(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 });

  return (
    <div className="page">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">
            <i className="fas fa-file-invoice" style={{ marginRight: 10, color: 'var(--orange)' }} />
            Orçamentos
          </h1>
          <p className="page-subtitle">{budgets.length} orçamento(s) no total</p>
        </div>
        <button className="btn btn-primary" onClick={() => navigate('/budgets/new')}>
          <i className="fas fa-plus" /> Novo Orçamento
        </button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {/* Status tabs */}
      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--gray-200)', marginBottom: 16, paddingBottom: 0 }}>
        {STATUS_TABS.map(tab => {
          const label = tab === 'todos' ? 'Todos' : (STATUS_CONFIG[tab]?.label || tab);
          const count = countByStatus(tab);
          return (
            <button
              key={tab}
              onClick={() => setStatusTab(tab)}
              style={{
                padding: '8px 16px', border: 'none', background: 'none', cursor: 'pointer',
                fontSize: 13, fontWeight: 600,
                color: statusTab === tab ? 'var(--orange)' : 'var(--gray-500)',
                borderBottom: statusTab === tab ? '2px solid var(--orange)' : '2px solid transparent',
                marginBottom: -1,
              }}
            >
              {label}
              <span style={{
                marginLeft: 6, fontSize: 11, fontWeight: 700,
                background: statusTab === tab ? 'var(--orange)' : 'var(--gray-200)',
                color: statusTab === tab ? 'white' : 'var(--gray-600)',
                borderRadius: 10, padding: '1px 6px',
              }}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Table */}
      <div className="card">
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Número</th>
                <th>Paciente</th>
                <th>Profissional</th>
                <th>Total</th>
                <th>Criado em</th>
                <th>Válido até</th>
                <th>Status</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={8}>
                  <div className="empty-state"><i className="fas fa-spinner fa-spin" /><p>Carregando...</p></div>
                </td></tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={8}>
                  <div className="empty-state">
                    <i className="fas fa-file-invoice" />
                    <p>Nenhum orçamento encontrado</p>
                  </div>
                </td></tr>
              )}
              {!loading && filtered.map(b => (
                <tr key={b.id}>
                  <td>
                    <span style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--blue)', fontSize: 13 }}>
                      {b.number || `ORC-${String(b.id).padStart(6, '0')}`}
                    </span>
                  </td>
                  <td>
                    <strong>{b.patient_name || '—'}</strong>
                  </td>
                  <td>{b.professional_name || '—'}</td>
                  <td>
                    <strong style={{ color: 'var(--success)' }}>
                      R$ {fmtMoney(b.total)}
                    </strong>
                  </td>
                  <td style={{ color: 'var(--gray-500)', fontSize: 13 }}>{fmtDate(b.created_at)}</td>
                  <td style={{ color: 'var(--gray-500)', fontSize: 13 }}>{fmtDate(b.valid_until)}</td>
                  <td><StatusBadge status={b.status} /></td>
                  <td>
                    <div className="table-actions">
                      {b.status === 'rascunho' && (
                        <button
                          className="btn btn-outline btn-sm"
                          title="Editar"
                          onClick={() => navigate(`/budgets/${b.id}/edit`)}
                        >
                          <i className="fas fa-pen" />
                        </button>
                      )}
                      <button
                        className="btn btn-outline btn-sm"
                        title="Visualizar / Imprimir"
                        onClick={() => navigate(`/budgets/${b.id}/print`)}
                        style={{ color: 'var(--blue)', borderColor: 'var(--blue)' }}
                      >
                        <i className="fas fa-print" />
                      </button>
                      <StatusDropdown budget={b} onStatusChange={handleStatusChange} />
                      <button
                        className="btn btn-danger btn-sm"
                        title="Excluir"
                        onClick={() => handleDelete(b.id)}
                      >
                        <i className="fas fa-trash" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
