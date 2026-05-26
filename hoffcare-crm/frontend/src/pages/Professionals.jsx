import { useState, useEffect } from 'react';
import api from '../services/api';
import Modal from '../components/Modal';
import { PROF_TYPES, getProfType } from '../config/professionalTypes';
import { useAuth } from '../context/AuthContext';

const empty = { type: 'medico', name: '', cpf: '', crm_cro: '', birthdate: '', email: '', phone: '' };

export default function Professionals() {
  const { user } = useAuth();
  const isAutonomous = !!user?.is_autonomous;
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
          <h1 className="page-title">Profissionais de Saúde</h1>
          <p className="page-subtitle">Médicos, dentistas e demais profissionais do consultório</p>
        </div>
        {!isAutonomous && (
          <button className="btn btn-primary" onClick={() => handleOpen()}><i className="fas fa-user-plus" /> Novo Profissional</button>
        )}
      </div>

      <div className="card">
        <div className="search-bar">
          <div className="search-input-wrapper">
            <i className="fas fa-search" />
            <input className="form-control" placeholder="Buscar por nome, CPF ou registro profissional..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>
        <div className="table-container">
          <table className="table">
            <thead>
              <tr><th>Especialidade</th><th>Nome</th><th>CPF</th><th>Registro</th><th>Telefone</th><th>Email</th><th>Ações</th></tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={7}><div className="empty-state"><i className="fas fa-user-md" /><p>Nenhum profissional encontrado</p></div></td></tr>
              )}
              {filtered.map(p => {
                const t = getProfType(p.type);
                return (
                  <tr key={p.id}>
                    <td>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: 5,
                        background: t.bg, color: t.color,
                        border: `1px solid ${t.border}33`,
                        borderRadius: 4, padding: '2px 8px', fontSize: 12, fontWeight: 600
                      }}>
                        {t.emoji} {t.label}
                      </span>
                    </td>
                    <td><strong>{p.name}</strong></td>
                    <td>{p.cpf || '—'}</td>
                    <td>
                      <span style={{ fontFamily: 'monospace', fontSize: 12 }}>
                        {p.crm_cro ? <><span style={{ color: 'var(--gray-400)', fontSize: 11 }}>{t.council} </span>{p.crm_cro}</> : '—'}
                      </span>
                    </td>
                    <td>{p.phone || '—'}</td>
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

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? 'Editar Profissional' : 'Novo Profissional'}
        footer={<><button className="btn btn-outline" onClick={() => setOpen(false)}>Cancelar</button><button className="btn btn-primary" onClick={handleSubmit}>Salvar</button></>}>
        {error && <div className="alert alert-error">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Especialidade <span className="required">*</span></label>
            <select className="form-control" {...f('type')}>
              {PROF_TYPES.map(t => (
                <option key={t.value} value={t.value}>{t.emoji} {t.label}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Nome Completo <span className="required">*</span></label>
            <input className="form-control" {...f('name')} required />
          </div>
          <div className="form-grid form-grid-2">
            <div className="form-group">
              <label className="form-label">CPF <span className="required">*</span></label>
              <input className="form-control" {...f('cpf')} placeholder="000.000.000-00" required />
            </div>
            <div className="form-group">
              <label className="form-label">{currentType.council} <span className="required">*</span></label>
              <input className="form-control" {...f('crm_cro')} placeholder={`${currentType.council}-XX 00000`} required />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Data de Nascimento</label>
            <input className="form-control" type="date" {...f('birthdate')} />
          </div>
          <div className="form-grid form-grid-2">
            <div className="form-group"><label className="form-label">Email</label><input className="form-control" type="email" {...f('email')} /></div>
            <div className="form-group"><label className="form-label">Telefone</label><input className="form-control" {...f('phone')} placeholder="(00) 00000-0000" /></div>
          </div>
        </form>
      </Modal>
    </div>
  );
}
