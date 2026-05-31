import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../services/api';
import Modal from '../components/Modal';
import { PROF_TYPES, getProfType } from '../config/professionalTypes';

const RECURRENCES = [
  { value: 'mensal',     tKey: 'rentals.recurrenceMonthly' },
  { value: 'unico',      tKey: 'rentals.recurrenceSingle' },
  { value: 'trimestral', tKey: 'rentals.recurrenceQuarterly' },
  { value: 'semestral',  tKey: 'rentals.recurrenceBiannual' },
  { value: 'anual',      tKey: 'rentals.recurrenceAnnual' },
];

const empty = {
  tenant_name: '', space_description: '', room_id: '',
  value: '', start_date: '', end_date: '', recurrence: 'mensal', notes: '', status: 'active',
};

const fmt = (v) => v ? parseFloat(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '—';

const statusBadge = (status, t) => status === 'active'
  ? { label: t ? t('rentals.active') : 'Ativo', bg: '#d4edda', color: '#155724' }
  : { label: t ? t('rentals.inactive') : 'Inativo', bg: '#f8d7da', color: '#721c24' };

export default function Rentals() {
  const { t } = useTranslation();
  const [items, setItems] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [professionals, setProfessionals] = useState([]);
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [manualName, setManualName] = useState(false);

  const load = async () => {
    const [r, rm, pr] = await Promise.all([
      api.get('/rentals').catch(() => ({ data: [] })),
      api.get('/rooms').catch(() => ({ data: [] })),
      api.get('/professionals').catch(() => ({ data: [] })),
    ]);
    setItems(r.data);
    setRooms(rm.data);
    setProfessionals(pr.data);
  };
  useEffect(() => { load(); }, []);

  const filtered = items.filter(i =>
    i.tenant_name.toLowerCase().includes(search.toLowerCase()) ||
    (i.space_description || '').toLowerCase().includes(search.toLowerCase())
  );

  const handleOpen = (item = null) => {
    setEditing(item);
    if (item) {
      setForm({
        ...item,
        start_date: item.start_date?.slice(0, 10) || '',
        end_date: item.end_date?.slice(0, 10) || '',
        room_id: item.room_id || '',
        value: item.value || '',
      });
      // Se o nome salvo não bate com nenhum profissional cadastrado, abre no modo manual
      const matchesProfessional = professionals.some(p => p.name === item.tenant_name);
      setManualName(!matchesProfessional);
    } else {
      setForm(empty);
      setManualName(false);
    }
    setError(''); setOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault(); setError('');
    try {
      if (editing) await api.put(`/rentals/${editing.id}`, form);
      else await api.post('/rentals', form);
      setOpen(false); load();
    } catch (err) { setError(err.response?.data?.error || t('rentals.errorSave')); }
  };

  const handleDelete = async (id) => {
    if (!confirm(t('rentals.delete'))) return;
    await api.delete(`/rentals/${id}`); load();
  };

  const f = (field) => ({
    value: form[field] ?? '',
    onChange: e => setForm(p => ({ ...p, [field]: e.target.value })),
  });

  const totalActive = items
    .filter(i => i.status === 'active')
    .reduce((s, i) => s + parseFloat(i.value || 0), 0);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">
            <i className="fas fa-key" style={{ marginRight: 10, color: 'var(--orange)' }} />
            {t('rentals.title')}
          </h1>
          <p className="page-subtitle">{t('rentals.subtitle')}</p>
        </div>
        <button className="btn btn-primary" onClick={() => handleOpen()}>
          <i className="fas fa-plus" /> {t('rentals.newRental')}
        </button>
      </div>

      {/* Card de resumo */}
      <div className="stats-grid" style={{ marginBottom: 20 }}>
        <div className="stat-card">
          <div className="stat-icon green"><i className="fas fa-dollar-sign" /></div>
          <div>
            <div className="stat-value" style={{ fontSize: 20 }}>
              R$ {totalActive.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
            <div className="stat-label">{t('rentals.totalMonthly')}</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon blue"><i className="fas fa-door-open" /></div>
          <div>
            <div className="stat-value">{items.filter(i => i.status === 'active').length}</div>
            <div className="stat-label">{t('rentals.activeRentals')}</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon orange"><i className="fas fa-list" /></div>
          <div>
            <div className="stat-value">{items.length}</div>
            <div className="stat-label">{t('rentals.totalRecords')}</div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="search-bar">
          <div className="search-input-wrapper">
            <i className="fas fa-search" />
            <input className="form-control" placeholder={t('rentals.searchPlaceholder')}
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>{t('rentals.tenant')}</th>
                <th>{t('rentals.space')}</th>
                <th>{t('rentals.value')}</th>
                <th>{t('rentals.recurrence')}</th>
                <th>{t('rentals.startDate')}</th>
                <th>{t('rentals.endDate')}</th>
                <th>{t('rentals.status')}</th>
                <th>{t('rentals.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={8}>
                  <div className="empty-state"><i className="fas fa-key" /><p>{t('rentals.empty')}</p></div>
                </td></tr>
              )}
              {filtered.map(item => {
                const badge = statusBadge(item.status, t);
                return (
                  <tr key={item.id}>
                    <td><strong>{item.tenant_name}</strong></td>
                    <td>{item.space_description || item.room_name || '—'}</td>
                    <td><strong style={{ color: 'var(--success)' }}>R$ {fmt(item.value)}</strong></td>
                    <td>{(() => { const rec = RECURRENCES.find(r => r.value === item.recurrence); return rec ? t(rec.tKey) : item.recurrence; })()}</td>
                    <td>{item.start_date ? new Date(item.start_date).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '—'}</td>
                    <td>{item.end_date ? new Date(item.end_date).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : t('rentals.indefinite')}</td>
                    <td>
                      <span style={{ background: badge.bg, color: badge.color, borderRadius: 4, padding: '2px 8px', fontSize: 12, fontWeight: 600 }}>
                        {badge.label}
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
        title={editing ? t('rentals.editRental') : t('rentals.newRental')}
        footer={
          <>
            <button className="btn btn-outline" onClick={() => setOpen(false)}>{t('rentals.cancel')}</button>
            <button className="btn btn-primary" onClick={handleSubmit}>{t('rentals.save')}</button>
          </>
        }>
        {error && <div className="alert alert-error">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">{t('rentals.tenant')} <span className="required">*</span></label>
            {!manualName ? (
              <>
                <select
                  className="form-control"
                  value={form.tenant_name}
                  onChange={e => setForm(p => ({ ...p, tenant_name: e.target.value }))}
                  required={!manualName}
                >
                  <option value="">{t('rentals.selectProfessional')}</option>
                  {PROF_TYPES.map(pt => {
                    const profs = professionals.filter(p => p.type === pt.value);
                    if (profs.length === 0) return null;
                    return (
                      <optgroup key={pt.value} label={`${pt.emoji} ${pt.label}`}>
                        {profs.map(p => (
                          <option key={p.id} value={p.name}>
                            {p.name}{p.crm_cro ? ` (${p.crm_cro})` : ''}
                          </option>
                        ))}
                      </optgroup>
                    );
                  })}
                </select>
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  style={{ marginTop: 6, fontSize: 12 }}
                  onClick={() => { setManualName(true); setForm(p => ({ ...p, tenant_name: '' })); }}
                >
                  <i className="fas fa-keyboard" /> {t('rentals.manualName')}
                </button>
              </>
            ) : (
              <>
                <input className="form-control" {...f('tenant_name')} required placeholder={t('rentals.tenantPlaceholder')} />
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  style={{ marginTop: 6, fontSize: 12 }}
                  onClick={() => { setManualName(false); setForm(p => ({ ...p, tenant_name: '' })); }}
                >
                  <i className="fas fa-user-md" /> {t('rentals.selectProfessional')}
                </button>
              </>
            )}
          </div>
          <div className="form-grid form-grid-2">
            <div className="form-group">
              <label className="form-label">{t('rentals.spaceDescription')}</label>
              <input className="form-control" {...f('space_description')} placeholder="Ex: Consultório 2" />
            </div>
            <div className="form-group">
              <label className="form-label">{t('rentals.room')}</label>
              <select className="form-control" {...f('room_id')}>
                <option value="">{t('rentals.noRoom')}</option>
                {rooms.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>
          </div>
          <div className="form-grid form-grid-2">
            <div className="form-group">
              <label className="form-label">{t('rentals.value')} (R$) <span className="required">*</span></label>
              <input className="form-control" type="number" step="0.01" min="0" {...f('value')} required />
            </div>
            <div className="form-group">
              <label className="form-label">{t('rentals.recurrence')}</label>
              <select className="form-control" {...f('recurrence')}>
                {RECURRENCES.map(r => <option key={r.value} value={r.value}>{t(r.tKey)}</option>)}
              </select>
            </div>
          </div>
          <div className="form-grid form-grid-2">
            <div className="form-group">
              <label className="form-label">{t('rentals.startDate')} <span className="required">*</span></label>
              <input className="form-control" type="date" {...f('start_date')} required />
            </div>
            <div className="form-group">
              <label className="form-label">{t('rentals.endDate')}</label>
              <input className="form-control" type="date" {...f('end_date')} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">{t('rentals.status')}</label>
            <select className="form-control" {...f('status')}>
              <option value="active">{t('rentals.active')}</option>
              <option value="inactive">{t('rentals.inactive')}</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">{t('rentals.notes')}</label>
            <textarea className="form-control" rows={3} {...f('notes')} />
          </div>
        </form>
      </Modal>
    </div>
  );
}
