import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../services/api';
import Modal from '../components/Modal';
import { PROF_TYPES, getProfType } from '../config/professionalTypes';
import { useAuth } from '../context/AuthContext';
import { formatPhone, formatCPF } from '../utils/format';

const empty = { type: 'dentista', name: '', cpf: '', crm_cro: '', birthdate: '', email: '', phone: '', repasse_percentual: '', repasse_type: 'percent', repasse_fixed: '' };

export default function Professionals() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isAutonomous = !!user?.is_autonomous;
  const canEditRepasse = ['responsavel', 'admin'].includes(user?.role);
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    const res = await api.get('/professionals');
    setItems(res.data);
  };
  useEffect(() => { load(); }, []);

  const filtered = items.filter(i =>
    i.name.toLowerCase().includes(search.toLowerCase()) ||
    (i.cpf || '').includes(search) ||
    (i.crm_cro || '').toLowerCase().includes(search.toLowerCase())
  );

  const handleOpen = (item = null) => {
    setEditing(item);
    setForm(item ? { ...item, birthdate: item.birthdate?.slice(0, 10) || '' } : empty);
    setError(''); setOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault(); setError('');
    try {
      if (editing) await api.put(`/professionals/${editing.id}`, form);
      else await api.post('/professionals', form);
      setOpen(false); load();
    } catch (err) { setError(err.response?.data?.error || 'Erro ao salvar'); }
  };

  const handleDelete = async (id) => {
    if (!confirm('Remover profissional?')) return;
    await api.delete(`/professionals/${id}`); load();
  };

  const f = (field) => ({ value: form[field] || '', onChange: e => setForm(p => ({ ...p, [field]: e.target.value })) });

  const currentType = getProfType(form.type);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('professionals.title')}</h1>
          <p className="page-subtitle">{t('professionals.subtitle')}</p>
        </div>
        {!isAutonomous && (
          <button className="btn btn-primary" onClick={() => handleOpen()}><i className="fas fa-user-plus" /> {t('professionals.newProfessional')}</button>
        )}
      </div>

      <div className="card">
        <div className="search-bar">
          <div className="search-input-wrapper">
            <i className="fas fa-search" />
            <input className="form-control" placeholder={t('professionals.searchPlaceholder')} value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>
        <div className="table-container">
          <table className="table">
            <thead>
              <tr><th>{t('professionals.specialty')}</th><th>{t('professionals.name')}</th><th>{t('professionals.cpf')}</th><th>{t('professionals.registry')}</th><th>{t('professionals.phone')}</th><th>{t('professionals.email')}</th><th>{t('professionals.actions')}</th></tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={7}><div className="empty-state"><i className="fas fa-user-md" /><p>{t('professionals.empty')}</p></div></td></tr>
              )}
              {filtered.map(p => {
                const profType = getProfType(p.type);
                return (
                  <tr key={p.id}>
                    <td>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: 5,
                        background: profType.bg, color: profType.color,
                        border: `1px solid ${profType.border}33`,
                        borderRadius: 4, padding: '2px 8px', fontSize: 12, fontWeight: 600
                      }}>
                        {profType.emoji} {profType.labelKey ? t(profType.labelKey) : profType.label}
                      </span>
                    </td>
                    <td><strong>{p.name}</strong></td>
                    <td>{formatCPF(p.cpf)}</td>
                    <td>
                      <span style={{ fontFamily: 'monospace', fontSize: 12 }}>
                        {p.crm_cro ? <><span style={{ color: 'var(--gray-400)', fontSize: 11 }}>{profType.council} </span>{p.crm_cro}</> : '—'}
                      </span>
                    </td>
                    <td>{formatPhone(p.phone)}</td>
                    <td>{p.email || '—'}</td>
                    <td><div className="table-actions">
                      <button className="btn btn-outline btn-sm" onClick={() => handleOpen(p)}><i className="fas fa-pen" /></button>
                      {!isAutonomous && (
                        <button className="btn btn-danger btn-sm" onClick={() => handleDelete(p.id)}><i className="fas fa-trash" /></button>
                      )}
                    </div></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? t('professionals.editProfessional') : t('professionals.newProfessional')}
        footer={<><button className="btn btn-outline" onClick={() => setOpen(false)}>{t('professionals.cancel')}</button><button className="btn btn-primary" onClick={handleSubmit}>{t('professionals.save')}</button></>}>
        {error && <div className="alert alert-error">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">{t('professionals.specialty')}</label>
            <select className="form-control" {...f('type')}>
              {PROF_TYPES.map(pt => (
                <option key={pt.value} value={pt.value}>{pt.emoji} {pt.label}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">{t('professionals.fullName')} <span className="required">*</span></label>
            <input className="form-control" {...f('name')} required />
          </div>
          <div className="form-grid form-grid-2">
            <div className="form-group">
              <label className="form-label">{t('professionals.cpf')}</label>
              <input className="form-control" {...f('cpf')} placeholder="000.000.000-00" />
            </div>
            <div className="form-group">
              <label className="form-label">{currentType.council}</label>
              <input className="form-control" {...f('crm_cro')} placeholder={`${currentType.council}-XX 00000`} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">{t('professionals.birthdate')}</label>
            <input className="form-control" type="date" {...f('birthdate')} />
          </div>
          <div className="form-grid form-grid-2">
            <div className="form-group"><label className="form-label">Email</label><input className="form-control" type="email" {...f('email')} /></div>
            <div className="form-group"><label className="form-label">Telefone</label><input className="form-control" {...f('phone')} placeholder="(00) 00000-0000" /></div>
          </div>

          {/* Repasse — visível para todos, editável só por responsavel/admin */}
          <div className="form-group" style={{
            background: canEditRepasse ? 'rgba(77,184,232,0.06)' : 'var(--gray-50)',
            border: '1px solid',
            borderColor: canEditRepasse ? 'rgba(77,184,232,0.3)' : 'var(--gray-200)',
            borderRadius: 8, padding: '12px 16px'
          }}>
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
              <i className="fas fa-handshake-simple" style={{ color: canEditRepasse ? 'var(--blue)' : 'var(--gray-400)', fontSize: 12 }} />
              Repasse ao profissional — padrão
              {!canEditRepasse && (
                <span style={{ marginLeft: 4, fontSize: 11, color: 'var(--gray-400)', fontWeight: 400 }}>
                  <i className="fas fa-lock" style={{ marginRight: 3 }} />restrito a responsável/admin
                </span>
              )}
            </label>

            {/* Toggle % vs Valor Fixo */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
              {['percent', 'fixed'].map(t => (
                <button key={t} type="button" disabled={!canEditRepasse}
                  onClick={() => setForm(p => ({ ...p, repasse_type: t }))}
                  style={{
                    padding: '5px 14px', borderRadius: 6, border: '1px solid',
                    cursor: canEditRepasse ? 'pointer' : 'default', fontSize: 12, fontWeight: 600,
                    background: form.repasse_type === t ? '#4DB8E8' : 'white',
                    color: form.repasse_type === t ? 'white' : 'var(--gray-500)',
                    borderColor: form.repasse_type === t ? '#4DB8E8' : 'var(--gray-200)',
                  }}>
                  {t === 'percent' ? '% Percentual' : 'R$ Valor fixo'}
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {form.repasse_type === 'percent' ? (
                <>
                  <input className="form-control" type="number" min="0" max="100" step="0.5"
                    placeholder={canEditRepasse ? 'Ex: 70' : '—'} style={{ maxWidth: 120 }}
                    disabled={!canEditRepasse} {...f('repasse_percentual')} />
                  <span style={{ fontWeight: 600, color: 'var(--gray-500)' }}>%</span>
                  {form.repasse_percentual && (
                    <span style={{ fontSize: 12, color: 'var(--gray-400)' }}>
                      = profissional recebe <strong style={{ color: 'var(--blue)' }}>{form.repasse_percentual}%</strong> do valor cobrado
                    </span>
                  )}
                </>
              ) : (
                <>
                  <span style={{ fontWeight: 600, color: 'var(--gray-500)' }}>R$</span>
                  <input className="form-control" type="number" min="0" step="0.01"
                    placeholder={canEditRepasse ? 'Ex: 150.00' : '—'} style={{ maxWidth: 140 }}
                    disabled={!canEditRepasse} {...f('repasse_fixed')} />
                  {form.repasse_fixed && (
                    <span style={{ fontSize: 12, color: 'var(--gray-400)' }}>
                      = profissional recebe <strong style={{ color: 'var(--blue)' }}>R$ {parseFloat(form.repasse_fixed || 0).toFixed(2)}</strong> fixo por consulta
                    </span>
                  )}
                </>
              )}
            </div>
            <div style={{ marginTop: 8, fontSize: 11, color: 'var(--gray-400)' }}>
              Este é o padrão. Pode ser ajustado individualmente em cada agendamento.
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
}
