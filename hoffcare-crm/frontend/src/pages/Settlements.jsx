import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../services/api';
import Modal from '../components/Modal';

const empty = {
  professional_id: '', value: '', date: new Date().toISOString().slice(0, 10),
  description: '', type: 'a_pagar', status: 'pendente',
};

const fmt = (v) => v ? parseFloat(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '0,00';

const TYPE_STYLE = {
  a_pagar: { color: '#dc3545', bg: '#f8d7da', icon: 'fa-arrow-up' },
  a_receber: { color: '#28a745', bg: '#d4edda', icon: 'fa-arrow-down' },
};

const STATUS_STYLE = {
  pendente: { tKey: 'settlements.pending', color: '#856404', bg: '#fff3cd' },
  pago:     { tKey: 'settlements.paid',    color: '#155724', bg: '#d4edda' },
};

export default function Settlements() {
  const { t } = useTranslation();
  const [items, setItems] = useState([]);
  const [professionals, setProfessionals] = useState([]);
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const [filterProf, setFilterProf] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const load = async () => {
    const [s, p] = await Promise.all([
      api.get('/settlements').catch(() => ({ data: [] })),
      api.get('/professionals').catch(() => ({ data: [] })),
    ]);
    setItems(s.data);
    setProfessionals(p.data);
  };
  useEffect(() => { load(); }, []);

  const filtered = items.filter(i => {
    if (filterProf && String(i.professional_id) !== filterProf) return false;
    if (filterStatus && i.status !== filterStatus) return false;
    return true;
  });

  const totalPagar = items.filter(i => i.type === 'a_pagar').reduce((s, i) => s + parseFloat(i.value || 0), 0);
  const totalReceber = items.filter(i => i.type === 'a_receber').reduce((s, i) => s + parseFloat(i.value || 0), 0);
  const totalPendente = items.filter(i => i.status === 'pendente').reduce((s, i) => s + parseFloat(i.value || 0), 0);

  const handleOpen = (item = null) => {
    setEditing(item);
    setForm(item ? {
      ...item,
      date: item.date?.slice(0, 10) || '',
      professional_id: item.professional_id || '',
    } : empty);
    setError(''); setOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault(); setError('');
    try {
      if (editing) await api.put(`/settlements/${editing.id}`, form);
      else await api.post('/settlements', form);
      setOpen(false); load();
    } catch (err) { setError(err.response?.data?.error || t('settlements.errorSave')); }
  };

  const handleDelete = async (id) => {
    if (!confirm(t('settlements.delete'))) return;
    await api.delete(`/settlements/${id}`); load();
  };

  const f = (field) => ({
    value: form[field] ?? '',
    onChange: e => setForm(p => ({ ...p, [field]: e.target.value })),
  });

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">
            <i className="fas fa-handshake" style={{ marginRight: 10, color: 'var(--blue)' }} />
            {t('settlements.title')}
          </h1>
          <p className="page-subtitle">{t('settlements.subtitle')}</p>
        </div>
        <button className="btn btn-primary" onClick={() => handleOpen()}>
          <i className="fas fa-plus" /> {t('settlements.newSettlement')}
        </button>
      </div>

      {/* Cards de resumo */}
      <div className="stats-grid" style={{ marginBottom: 20 }}>
        <div className="stat-card">
          <div className="stat-icon red" style={{ background: '#f8d7da' }}>
            <i className="fas fa-arrow-up" style={{ color: '#dc3545' }} />
          </div>
          <div>
            <div className="stat-value" style={{ fontSize: 20, color: '#dc3545' }}>
              R$ {fmt(totalPagar)}
            </div>
            <div className="stat-label">{t('settlements.toPay')}</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon green"><i className="fas fa-arrow-down" /></div>
          <div>
            <div className="stat-value" style={{ fontSize: 20, color: 'var(--success)' }}>
              R$ {fmt(totalReceber)}
            </div>
            <div className="stat-label">{t('settlements.toReceive')}</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon orange"><i className="fas fa-clock" /></div>
          <div>
            <div className="stat-value" style={{ fontSize: 20 }}>
              R$ {fmt(totalPendente)}
            </div>
            <div className="stat-label">{t('settlements.pending')}</div>
          </div>
        </div>
      </div>

      <div className="card">
        {/* Filtros */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
          <select className="form-control" style={{ width: 200 }}
            value={filterProf} onChange={e => setFilterProf(e.target.value)}>
            <option value="">{t('settlements.allProfessionals')}</option>
            {professionals.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <select className="form-control" style={{ width: 160 }}
            value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
            <option value="">{t('settlements.allStatuses')}</option>
            <option value="pendente">{t('settlements.pending')}</option>
            <option value="pago">{t('settlements.paid')}</option>
          </select>
        </div>

        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>{t('settlements.date')}</th>
                <th>{t('settlements.professional')}</th>
                <th>{t('settlements.type')}</th>
                <th>{t('settlements.description')}</th>
                <th>{t('settlements.value')}</th>
                <th>{t('settlements.status')}</th>
                <th>{t('settlements.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={7}>
                  <div className="empty-state"><i className="fas fa-handshake" /><p>{t('settlements.empty')}</p></div>
                </td></tr>
              )}
              {filtered.map(item => {
                const typeInfo = TYPE_STYLE[item.type] || TYPE_STYLE.a_pagar;
                const statusInfo = STATUS_STYLE[item.status] || STATUS_STYLE.pendente;
                return (
                  <tr key={item.id}>
                    <td>{item.date ? new Date(item.date).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '—'}</td>
                    <td>{item.professional_name || <span style={{ color: 'var(--gray-400)' }}>—</span>}</td>
                    <td>
                      <span style={{ background: typeInfo.bg, color: typeInfo.color, borderRadius: 4, padding: '2px 8px', fontSize: 12, fontWeight: 600 }}>
                        <i className={`fas ${typeInfo.icon}`} style={{ marginRight: 4, fontSize: 10 }} />
                        {item.type === 'a_pagar' ? t('settlements.toPay') : t('settlements.toReceive')}
                      </span>
                    </td>
                    <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item.description || '—'}
                    </td>
                    <td>
                      <strong style={{ color: item.type === 'a_pagar' ? '#dc3545' : 'var(--success)' }}>
                        {item.type === 'a_pagar' ? '−' : '+'} R$ {fmt(item.value)}
                      </strong>
                    </td>
                    <td>
                      <span style={{ background: statusInfo.bg, color: statusInfo.color, borderRadius: 4, padding: '2px 8px', fontSize: 12, fontWeight: 600 }}>
                        {t(statusInfo.tKey)}
                      </span>
                    </td>
                    <td>
                      <div className="table-actions">
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

      <Modal open={open} onClose={() => setOpen(false)}
        title={editing ? t('settlements.editSettlement') : t('settlements.newSettlement')}
        footer={
          <>
            <button className="btn btn-outline" onClick={() => setOpen(false)}>{t('settlements.cancel')}</button>
            <button className="btn btn-primary" onClick={handleSubmit}>{t('settlements.save')}</button>
          </>
        }>
        {error && <div className="alert alert-error">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">{t('settlements.type')} <span className="required">*</span></label>
            <select className="form-control" {...f('type')}>
              <option value="a_pagar">{t('settlements.typePayLabel')}</option>
              <option value="a_receber">{t('settlements.typeReceiveLabel')}</option>
            </select>
          </div>
          <div className="form-grid form-grid-2">
            <div className="form-group">
              <label className="form-label">{t('settlements.professional')}</label>
              <select className="form-control" {...f('professional_id')}>
                <option value="">{t('settlements.none')}</option>
                {professionals.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">{t('settlements.date')} <span className="required">*</span></label>
              <input className="form-control" type="date" {...f('date')} required />
            </div>
          </div>
          <div className="form-grid form-grid-2">
            <div className="form-group">
              <label className="form-label">{t('settlements.value')} (R$) <span className="required">*</span></label>
              <input className="form-control" type="number" step="0.01" min="0" {...f('value')} required />
            </div>
            <div className="form-group">
              <label className="form-label">{t('settlements.status')}</label>
              <select className="form-control" {...f('status')}>
                <option value="pendente">{t('settlements.pending')}</option>
                <option value="pago">{t('settlements.paid')}</option>
              </select>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">{t('settlements.description')}</label>
            <textarea className="form-control" rows={3} {...f('description')}
              placeholder={t('settlements.descriptionPlaceholder')} />
          </div>
        </form>
      </Modal>
    </div>
  );
}
