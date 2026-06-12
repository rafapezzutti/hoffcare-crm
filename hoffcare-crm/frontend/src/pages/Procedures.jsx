import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../services/api';
import Modal from '../components/Modal';
import { PROF_TYPES, getProfType } from '../config/professionalTypes';

// Clínica odontológica — apenas procedimentos dentais
const PROC_TYPES = [
  { value: 'odontologico', label: 'Odontológico', emoji: '🦷' },
];

const empty = { type: 'odontologico', code: '', name: '', cho: '' };

export default function Procedures() {
  const { t } = useTranslation();
  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const PER_PAGE = 30;

  const load = async () => {
    const res = await api.get('/procedures');
    setItems(res.data);
  };
  useEffect(() => { load(); }, []);

  const filtered = items.filter(i =>
    (typeFilter === '' || i.type === typeFilter) &&
    (filter === '' || i.name.toLowerCase().includes(filter.toLowerCase()) || i.code.includes(filter))
  );

  const paged = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);
  const totalPages = Math.ceil(filtered.length / PER_PAGE);

  const handleOpen = (item = null) => {
    setEditing(item);
    setForm(item ? { type: item.type, code: item.code, name: item.name, cho: item.cho || '' } : empty);
    setError(''); setOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault(); setError('');
    try {
      if (editing) await api.put(`/procedures/${editing.id}`, form);
      else await api.post('/procedures', form);
      setOpen(false); load();
    } catch (err) { setError(err.response?.data?.error || 'Erro ao salvar'); }
  };

  const handleDelete = async (id) => {
    if (!confirm('Desativar procedimento?')) return;
    await api.delete(`/procedures/${id}`); load();
  };

  const f = (field) => ({ value: form[field] || '', onChange: e => setForm(p => ({ ...p, [field]: e.target.value })) });

  const getProcBadge = (type) => {
    if (type === 'odontologico') return getProfType('dentista');
    return getProfType(type);
  };

  const isOdonto = form.type === 'odontologico' || form.type === 'dentista';

  return (
    <div className="page">
      <div className="page-header">
        <div><h1 className="page-title">{t('procedures.title')}</h1><p className="page-subtitle">{t('procedures.subtitle', { count: items.length })}</p></div>
        <button className="btn btn-primary" onClick={() => handleOpen()}><i className="fas fa-plus" /> {t('procedures.newProcedure')}</button>
      </div>

      <div className="card">
        <div className="search-bar">
          <div className="search-input-wrapper">
            <i className="fas fa-search" />
            <input className="form-control" placeholder={t('procedures.searchPlaceholder')} value={filter} onChange={e => { setFilter(e.target.value); setPage(1); }} />
          </div>
          <select className="form-control" style={{ width: 200 }} value={typeFilter} onChange={e => { setTypeFilter(e.target.value); setPage(1); }}>
            <option value="">{t('procedures.allSpecialties')}</option>
            {PROC_TYPES.map(pt => (
              <option key={pt.value} value={pt.value}>{pt.emoji} {pt.label}</option>
            ))}
          </select>
          <span style={{ fontSize: 13, color: 'var(--gray-500)', whiteSpace: 'nowrap' }}>{filtered.length} resultado(s)</span>
        </div>

        <div className="table-container">
          <table className="table">
            <thead>
              <tr><th>{t('procedures.specialty')}</th><th>{t('procedures.code')}</th><th>{t('procedures.name')}</th><th>{t('procedures.cho')}</th><th>{t('procedures.actions')}</th></tr>
            </thead>
            <tbody>
              {paged.length === 0 && (
                <tr><td colSpan={5}><div className="empty-state"><i className="fas fa-list-check" /><p>{t('procedures.empty')}</p></div></td></tr>
              )}
              {paged.map(p => {
                const procBadge = getProcBadge(p.type);
                return (
                  <tr key={p.id}>
                    <td>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: 5,
                        background: procBadge.bg, color: procBadge.color,
                        border: `1px solid ${procBadge.border}33`,
                        borderRadius: 4, padding: '2px 8px', fontSize: 12, fontWeight: 600
                      }}>
                        {procBadge.emoji} {p.type === 'odontologico' ? 'Odonto' : procBadge.short}
                      </span>
                    </td>
                    <td><code style={{ fontSize: 12, background: 'var(--gray-100)', padding: '2px 6px', borderRadius: 4 }}>{p.code}</code></td>
                    <td style={{ maxWidth: 400 }}>{p.name}</td>
                    <td>{p.cho || '—'}</td>
                    <td><div className="table-actions">
                      <button className="btn btn-outline btn-sm" onClick={() => handleOpen(p)}><i className="fas fa-pen" /></button>
                      <button className="btn btn-danger btn-sm" onClick={() => handleDelete(p.id)}><i className="fas fa-trash" /></button>
                    </div></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 16 }}>
            <button className="btn btn-outline btn-sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Anterior</button>
            <span style={{ padding: '6px 12px', fontSize: 13 }}>{page} / {totalPages}</span>
            <button className="btn btn-outline btn-sm" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>Próxima</button>
          </div>
        )}
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? t('procedures.editProcedure') : t('procedures.newProcedure')}
        footer={<><button className="btn btn-outline" onClick={() => setOpen(false)}>{t('procedures.cancel')}</button><button className="btn btn-primary" onClick={handleSubmit}>{t('procedures.save')}</button></>}>
        {error && <div className="alert alert-error">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">{t('procedures.specialty')} <span className="required">*</span></label>
            <select className="form-control" {...f('type')}>
              {PROC_TYPES.map(pt => (
                <option key={pt.value} value={pt.value}>{pt.emoji} {pt.label}</option>
              ))}
            </select>
          </div>
          <div className="form-grid form-grid-2">
            <div className="form-group">
              <label className="form-label">{t('procedures.code')} <span className="required">*</span></label>
              <input className="form-control" {...f('code')} required />
            </div>
            {isOdonto && (
              <div className="form-group">
                <label className="form-label">{t('procedures.cho')}</label>
                <input className="form-control" type="number" {...f('cho')} />
              </div>
            )}
          </div>
          <div className="form-group">
            <label className="form-label">{t('procedures.procedureName')} <span className="required">*</span></label>
            <textarea className="form-control" {...f('name')} required rows={2} />
          </div>
        </form>
      </Modal>
    </div>
  );
}
