import { useState, useEffect } from 'react';
import api from '../services/api';
import Modal from '../components/Modal';

const CATEGORIES = [
  { value: 'luz',                label: 'Energia Elétrica',   icon: 'fa-bolt',           color: '#f59e0b' },
  { value: 'agua',               label: 'Água',               icon: 'fa-droplet',         color: '#3b82f6' },
  { value: 'gas',                label: 'Gás',                icon: 'fa-fire',            color: '#ef4444' },
  { value: 'aluguel',            label: 'Aluguel',            icon: 'fa-building',        color: '#8b5cf6' },
  { value: 'iptu',               label: 'IPTU',               icon: 'fa-landmark',        color: '#64748b' },
  { value: 'condominio',         label: 'Condomínio',         icon: 'fa-city',            color: '#6366f1' },
  { value: 'internet',           label: 'Internet/Telefone',  icon: 'fa-wifi',            color: '#0ea5e9' },
  { value: 'manutencao',         label: 'Manutenção',         icon: 'fa-wrench',          color: '#78716c' },
  { value: 'equipamento',        label: 'Equipamentos',       icon: 'fa-stethoscope',     color: '#10b981' },
  { value: 'material_escritorio',label: 'Material Escritório',icon: 'fa-paperclip',       color: '#f97316' },
  { value: 'contador',           label: 'Contador/Advogado',  icon: 'fa-scale-balanced',  color: '#0f766e' },
  { value: 'marketing',          label: 'Marketing',          icon: 'fa-bullhorn',        color: '#e11d48' },
  { value: 'outro',              label: 'Outro',              icon: 'fa-tag',             color: '#94a3b8' },
];

const CAT_MAP = Object.fromEntries(CATEGORIES.map(c => [c.value, c]));
const MONTHS  = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const RECURRENCE_LABELS = { none: 'Única', monthly: 'Mensal', annual: 'Anual' };

function fmt(val) {
  return Number(val || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function fmtDate(d) {
  if (!d) return '-';
  return new Date(d + 'T12:00:00').toLocaleDateString('pt-BR');
}

function isOverdue(exp) {
  if (exp.status === 'pago') return false;
  return new Date(exp.due_date + 'T12:00:00') < new Date(new Date().toDateString());
}

const emptyForm = {
  category: 'aluguel', description: '', amount: '', due_date: '',
  status: 'pendente', paid_date: '', recurrence: 'none', notes: '',
};

export default function Expenses() {
  const now = new Date();
  const [items,       setItems]       = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [filterStatus,setFilterStatus]= useState('all');
  const [filterCat,   setFilterCat]   = useState('');
  const [filterMonth, setFilterMonth] = useState(now.getMonth() + 1);
  const [filterYear,  setFilterYear]  = useState(now.getFullYear());
  const [showAll,     setShowAll]     = useState(false);
  const [form,        setForm]        = useState(emptyForm);
  const [editing,     setEditing]     = useState(null);
  const [open,        setOpen]        = useState(false);
  const [error,       setError]       = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const params = {};
      if (filterStatus !== 'all') params.status = filterStatus;
      if (filterCat) params.category = filterCat;
      if (!showAll) { params.month = filterMonth; params.year = filterYear; }
      const res = await api.get('/expenses', { params });
      setItems(res.data);
    } catch (err) {
      console.error(err);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [filterStatus, filterCat, filterMonth, filterYear, showAll]);

  const handleOpen = (item = null) => {
    setEditing(item);
    if (item) {
      setForm({
        ...item,
        due_date:  item.due_date?.slice(0, 10)  || '',
        paid_date: item.paid_date?.slice(0, 10) || '',
      });
    } else {
      setForm(emptyForm);
    }
    setError('');
    setOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault(); setError('');
    try {
      const payload = { ...form, amount: parseFloat(form.amount) };
      if (editing) await api.put(`/expenses/${editing.id}`, payload);
      else         await api.post('/expenses', payload);
      setOpen(false); load();
    } catch (err) { setError(err.response?.data?.error || 'Erro ao salvar'); }
  };

  const handlePay = async (item) => {
    const today = new Date().toISOString().slice(0, 10);
    await api.put(`/expenses/${item.id}`, {
      ...item,
      due_date:  item.due_date?.slice(0, 10),
      paid_date: today,
      status:    'pago',
    });
    load();
  };

  const handleDelete = async (id) => {
    if (!confirm('Remover despesa?')) return;
    await api.delete(`/expenses/${id}`); load();
  };

  // Totais
  const totalPendente = items.filter(i => i.status === 'pendente' && !isOverdue(i)).reduce((s, i) => s + parseFloat(i.amount), 0);
  const totalVencido  = items.filter(i => isOverdue(i)).reduce((s, i) => s + parseFloat(i.amount), 0);
  const totalPago     = items.filter(i => i.status === 'pago').reduce((s, i) => s + parseFloat(i.amount), 0);
  const totalGeral    = items.reduce((s, i) => s + parseFloat(i.amount), 0);

  const f = (field) => ({ value: form[field] || '', onChange: e => setForm(p => ({ ...p, [field]: e.target.value })) });

  const years = [];
  for (let y = now.getFullYear() - 1; y <= now.getFullYear() + 2; y++) years.push(y);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Despesas</h1>
          <p className="page-subtitle">Controle de despesas operacionais da clínica</p>
        </div>
        <button className="btn btn-primary" onClick={() => handleOpen()}>
          <i className="fas fa-plus" /> Nova Despesa
        </button>
      </div>

      {/* Cards de resumo */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        {[
          { label: 'Total Período', value: fmt(totalGeral),    color: '#6366f1', icon: 'fa-wallet' },
          { label: 'A Vencer',      value: fmt(totalPendente), color: '#f59e0b', icon: 'fa-clock' },
          { label: 'Vencido',       value: fmt(totalVencido),  color: '#ef4444', icon: 'fa-circle-exclamation' },
          { label: 'Pago',          value: fmt(totalPago),     color: '#22c55e', icon: 'fa-circle-check' },
        ].map(card => (
          <div key={card.label} className="card" style={{ padding: '16px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: card.color + '20', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <i className={`fas ${card.icon}`} style={{ color: card.color, fontSize: 15 }} />
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--gray-500)', marginBottom: 2 }}>{card.label}</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: card.color }}>{card.value}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div className="card" style={{ marginBottom: 16, padding: '14px 20px' }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <label style={{ fontSize: 12, color: 'var(--gray-500)', whiteSpace: 'nowrap' }}>Período:</label>
            <select className="form-control" style={{ width: 80 }} value={filterMonth}
              onChange={e => setFilterMonth(Number(e.target.value))} disabled={showAll}>
              {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
            </select>
            <select className="form-control" style={{ width: 76 }} value={filterYear}
              onChange={e => setFilterYear(Number(e.target.value))} disabled={showAll}>
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <label style={{ fontSize: 12, color: 'var(--gray-500)', display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', whiteSpace: 'nowrap' }}>
              <input type="checkbox" checked={showAll} onChange={e => setShowAll(e.target.checked)} style={{ marginRight: 2 }} />
              Todos
            </label>
          </div>
          <select className="form-control" style={{ width: 160 }} value={filterCat}
            onChange={e => setFilterCat(e.target.value)}>
            <option value="">Todas categorias</option>
            {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
          <select className="form-control" style={{ width: 130 }} value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}>
            <option value="all">Todos status</option>
            <option value="pendente">A Vencer</option>
            <option value="vencido">Vencido</option>
            <option value="pago">Pago</option>
          </select>
        </div>
      </div>

      {/* Tabela */}
      <div className="card">
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Categoria</th>
                <th>Descrição</th>
                <th>Vencimento</th>
                <th>Valor</th>
                <th>Status</th>
                <th>Recorrência</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={7}>
                  <div className="empty-state"><i className="fas fa-spinner fa-spin" /><p>Carregando...</p></div>
                </td></tr>
              )}
              {!loading && items.length === 0 && (
                <tr><td colSpan={7}>
                  <div className="empty-state">
                    <i className="fas fa-file-invoice-dollar" />
                    <p>Nenhuma despesa encontrada</p>
                    <button className="btn btn-primary" onClick={() => handleOpen()}>
                      <i className="fas fa-plus" /> Nova Despesa
                    </button>
                  </div>
                </td></tr>
              )}
              {items.map(item => {
                const overdue = isOverdue(item);
                const cat = CAT_MAP[item.category] || { label: item.category, icon: 'fa-tag', color: '#94a3b8' };
                return (
                  <tr key={item.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 28, height: 28, borderRadius: 6, background: cat.color + '20', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <i className={`fas ${cat.icon}`} style={{ color: cat.color, fontSize: 12 }} />
                        </div>
                        <span style={{ fontSize: 13 }}>{cat.label}</span>
                      </div>
                    </td>
                    <td style={{ fontSize: 13, color: 'var(--gray-600)' }}>{item.description || '—'}</td>
                    <td style={{ fontSize: 13, color: overdue ? '#ef4444' : undefined, fontWeight: overdue ? 600 : undefined }}>
                      {fmtDate(item.due_date)}
                      {overdue && (
                        <span style={{ marginLeft: 6, fontSize: 10, background: '#fef2f2', color: '#ef4444', padding: '1px 6px', borderRadius: 4, border: '1px solid #fca5a5' }}>
                          VENCIDA
                        </span>
                      )}
                    </td>
                    <td style={{ fontSize: 14, fontWeight: 600 }}>{fmt(item.amount)}</td>
                    <td>
                      {item.status === 'pago'
                        ? <span className="badge badge-green">Pago{item.paid_date ? ` ${fmtDate(item.paid_date)}` : ''}</span>
                        : overdue
                        ? <span className="badge badge-red">Vencido</span>
                        : <span className="badge badge-orange">Pendente</span>}
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--gray-500)' }}>
                      {RECURRENCE_LABELS[item.recurrence] || item.recurrence}
                    </td>
                    <td>
                      <div className="table-actions">
                        {item.status !== 'pago' && (
                          <button className="btn btn-outline btn-sm" title="Marcar como pago"
                            onClick={() => handlePay(item)}
                            style={{ color: '#22c55e', borderColor: '#22c55e' }}>
                            <i className="fas fa-check" />
                          </button>
                        )}
                        <button className="btn btn-outline btn-sm" onClick={() => handleOpen(item)}>
                          <i className="fas fa-pen" />
                        </button>
                        <button className="btn btn-danger btn-sm" onClick={() => handleDelete(item.id)}>
                          <i className="fas fa-trash" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal criar/editar */}
      <Modal open={open} onClose={() => setOpen(false)}
        title={editing ? 'Editar Despesa' : 'Nova Despesa'}
        footer={
          <>
            <button className="btn btn-outline" onClick={() => setOpen(false)}>Cancelar</button>
            <button className="btn btn-primary" onClick={handleSubmit}>Salvar</button>
          </>
        }>
        {error && <div className="alert alert-error"><i className="fas fa-circle-exclamation" /> {error}</div>}
        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label className="form-label">Categoria <span className="required">*</span></label>
              <select className="form-control" {...f('category')}>
                {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label className="form-label">Descrição</label>
              <input className="form-control" {...f('description')} placeholder="Ex: Aluguel mês de Junho" />
            </div>
            <div className="form-group">
              <label className="form-label">Valor (R$) <span className="required">*</span></label>
              <input className="form-control" type="number" step="0.01" min="0" {...f('amount')} required />
            </div>
            <div className="form-group">
              <label className="form-label">Vencimento <span className="required">*</span></label>
              <input className="form-control" type="date" {...f('due_date')} required />
            </div>
            <div className="form-group">
              <label className="form-label">Recorrência</label>
              <select className="form-control" {...f('recurrence')}>
                <option value="none">Única</option>
                <option value="monthly">Mensal</option>
                <option value="annual">Anual</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Status</label>
              <select className="form-control" {...f('status')}>
                <option value="pendente">Pendente</option>
                <option value="pago">Pago</option>
              </select>
            </div>
            {form.status === 'pago' && (
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label className="form-label">Data de Pagamento</label>
                <input className="form-control" type="date" {...f('paid_date')} />
              </div>
            )}
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label className="form-label">Observações</label>
              <textarea className="form-control" rows={2} {...f('notes')} />
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
}
