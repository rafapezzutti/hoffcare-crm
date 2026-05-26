import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../services/api';
import Modal from '../components/Modal';

export default function Rooms() {
  const { t } = useTranslation();
  const [items, setItems] = useState([]);
  const [form, setForm] = useState({ type: 'dentista', name: '' });
  const [editing, setEditing] = useState(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');

  const load = async () => { const r = await api.get('/rooms'); setItems(r.data); };
  useEffect(() => { load(); }, []);

  const handleOpen = (item = null) => {
    setEditing(item);
    setForm(item ? { type: item.type, name: item.name } : { type: 'dentista', name: '' });
    setError(''); setOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault(); setError('');
    try {
      if (editing) await api.put(`/rooms/${editing.id}`, form);
      else await api.post('/rooms', form);
      setOpen(false); load();
    } catch (err) { setError(err.response?.data?.error || 'Erro ao salvar'); }
  };

  const handleDelete = async (id) => {
    if (!confirm(t('rooms.removeRoom'))) return;
    await api.delete(`/rooms/${id}`); load();
  };

  return (
    <div className="page">
      <div className="page-header">
        <div><h1 className="page-title">{t('rooms.title')}</h1><p className="page-subtitle">{t('rooms.subtitle')}</p></div>
        <button className="btn btn-primary" onClick={() => handleOpen()}><i className="fas fa-plus" /> {t('rooms.newRoom')}</button>
      </div>

      <div className="card">
        <div className="table-container">
          <table className="table">
            <thead><tr><th>{t('rooms.type')}</th><th>{t('rooms.roomName')}</th><th>{t('rooms.actions')}</th></tr></thead>
            <tbody>
              {items.length === 0 && <tr><td colSpan={3}><div className="empty-state"><i className="fas fa-door-open" /><p>{t('rooms.empty')}</p></div></td></tr>}
              {items.map(r => (
                <tr key={r.id}>
                  <td><span className={`badge ${r.type === 'medico' ? 'badge-orange' : 'badge-blue'}`}>{r.type === 'medico' ? '🩺 Médico' : '🦷 Dentista'}</span></td>
                  <td><strong>{r.name}</strong></td>
                  <td><div className="table-actions">
                    <button className="btn btn-outline btn-sm" onClick={() => handleOpen(r)}><i className="fas fa-pen" /></button>
                    <button className="btn btn-danger btn-sm" onClick={() => handleDelete(r.id)}><i className="fas fa-trash" /></button>
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? t('rooms.editRoom') : t('rooms.newRoom')}
        footer={<><button className="btn btn-outline" onClick={() => setOpen(false)}>{t('rooms.cancel')}</button><button className="btn btn-primary" onClick={handleSubmit}>{t('rooms.save')}</button></>}>
        {error && <div className="alert alert-error">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-group"><label className="form-label">Tipo <span className="required">*</span></label>
            <select className="form-control" value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))}>
              <option value="dentista">Sala Dentista</option>
              <option value="medico">Sala Médico</option>
            </select>
          </div>
          <div className="form-group"><label className="form-label">Nome da Sala <span className="required">*</span></label>
            <input className="form-control" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Ex: Sala 01, Consultório A..." required />
          </div>
        </form>
      </Modal>
    </div>
  );
}
