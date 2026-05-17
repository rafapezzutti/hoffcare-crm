import { useState, useEffect } from 'react';
import api from '../services/api';
import Modal from '../components/Modal';

const empty = { type: 'odontologico', code: '', name: '', cho: '' };

export default function Procedures() {
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

  return (
    <div className="page">
      <div className="page-header">
        <div><h1 className="page-title">Procedimentos</h1><p className="page-subtitle">{items.length} procedimentos cadastrados</p></div>
        <button className="btn btn-primary" onClick={() => handleOpen()}><i className="fas fa-plus" /> Novo Procedimento</button>
      </div>

      <div className="card">
        <div className="search-bar">
          <div className="search-input-wrapper">
            <i className="fas fa-search" />
            <input className="form-control" placeholder="Buscar por nome ou código..." value={filter} onChange={e => { setFilter(e.target.value); setPage(1); }} />
          </div>
          <select className="form-control" style={{ width: 180 }} value={typeFilter} onChange={e => { setTypeFilter(e.target.value); setPage(1); }}>
            <option value="">Todos os tipos</option>
            <option value="odontologico">Odontológico</option>
            <option value="medico">Médico</option>
          </select>
          <span style={{ fontSize: 13, color: 'var(--gray-500)', whiteSpace: 'nowrap' }}>{filtered.length} resultado(s)</span>
        </div>

        <div className="table-container">
          <table className="table">
            <thead><tr><th>Tipo</th><th>Código</th><th>Procedimento</th><th>CHO</th><th>Ações</th></tr></thead>
            <tbody>
              {paged.length === 0 && <tr><td colSpan={5}><div className="empty-state"><i className="fas fa-list-check" /><p>Nenhum procedimento encontrado</p></div></td></tr>}
              {paged.map(p => (
                <tr key={p.id}>
                  <td><span className={`badge ${p.type === 'medico' ? 'badge-orange' : 'badge-blue'}`}>{p.type === 'medico' ? 'Médico' : 'Odonto'}</span></td>
                  <td><code style={{ fontSize: 12, background: 'var(--gray-100)', padding: '2px 6px', borderRadius: 4 }}>{p.code}</code></td>
                  <td style={{ maxWidth: 400 }}>{p.name}</td>
                  <td>{p.cho || '-'}</td>
                  <td><div className="table-actions">
                    <button className="btn btn-outline btn-sm" onClick={() => handleOpen(p)}><i className="fas fa-pen" /></button>
                    <button className="btn btn-danger btn-sm" onClick={() => handleDelete(p.id)}><i className="fas fa-trash" /></button>
                  </div></td>
                </tr>
              ))}
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

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? 'Editar Procedimento' : 'Novo Procedimento'}
        footer={<><button className="btn btn-outline" onClick={() => setOpen(false)}>Cancelar</button><button className="btn btn-primary" onClick={handleSubmit}>Salvar</button></>}>
        {error && <div className="alert alert-error">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-group"><label className="form-label">Tipo <span className="required">*</span></label>
            <select className="form-control" {...f('type')}>
              <option value="odontologico">Odontológico</option>
              <option value="medico">Médico</option>
            </select>
          </div>
          <div className="form-grid form-grid-2">
            <div className="form-group"><label className="form-label">Código <span className="required">*</span></label><input className="form-control" {...f('code')} required /></div>
            <div className="form-group"><label className="form-label">CHO</label><input className="form-control" type="number" {...f('cho')} /></div>
          </div>
          <div className="form-group"><label className="form-label">Nome do Procedimento <span className="required">*</span></label>
            <textarea className="form-control" {...f('name')} required rows={2} />
          </div>
        </form>
      </Modal>
    </div>
  );
}
