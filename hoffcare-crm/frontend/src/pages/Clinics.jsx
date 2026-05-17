import { useState, useEffect } from 'react';
import api from '../services/api';
import Modal from '../components/Modal';

const empty = { name: '', responsible_name: '', responsible_cpf: '', cep: '', street: '', number: '', complement: '', phone: '', email: '' };

export default function Clinics() {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    const res = await api.get('/clinics');
    setItems(res.data);
  };

  useEffect(() => { load(); }, []);

  const handleOpen = (item = null) => {
    setEditing(item);
    setForm(item ? { ...item } : empty);
    setError('');
    setOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      if (editing) await api.put(`/clinics/${editing.id}`, form);
      else await api.post('/clinics', form);
      setOpen(false);
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao salvar');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Remover consultório?')) return;
    await api.delete(`/clinics/${id}`);
    load();
  };

  const f = (field) => ({ value: form[field] || '', onChange: e => setForm(p => ({ ...p, [field]: e.target.value })) });

  return (
    <div className="page">
      <div className="page-header">
        <div><h1 className="page-title">Consultórios</h1><p className="page-subtitle">Gerenciar unidades</p></div>
        <button className="btn btn-primary" onClick={() => handleOpen()}><i className="fas fa-plus" /> Novo Consultório</button>
      </div>

      <div className="card">
        <div className="table-container">
          <table className="table">
            <thead><tr><th>Nome</th><th>Responsável</th><th>Telefone</th><th>Email</th><th>Ações</th></tr></thead>
            <tbody>
              {items.length === 0 && <tr><td colSpan={5}><div className="empty-state"><i className="fas fa-hospital" /><p>Nenhum consultório cadastrado</p></div></td></tr>}
              {items.map(c => (
                <tr key={c.id}>
                  <td><strong>{c.name}</strong></td>
                  <td>{c.responsible_name || '-'}</td>
                  <td>{c.phone || '-'}</td>
                  <td>{c.email || '-'}</td>
                  <td><div className="table-actions">
                    <button className="btn btn-outline btn-sm" onClick={() => handleOpen(c)}><i className="fas fa-pen" /></button>
                    <button className="btn btn-danger btn-sm" onClick={() => handleDelete(c.id)}><i className="fas fa-trash" /></button>
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? 'Editar Consultório' : 'Novo Consultório'}
        footer={<><button className="btn btn-outline" onClick={() => setOpen(false)}>Cancelar</button><button className="btn btn-primary" onClick={handleSubmit}>Salvar</button></>}>
        {error && <div className="alert alert-error">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-group"><label className="form-label">Nome <span className="required">*</span></label><input className="form-control" {...f('name')} required /></div>
          <div className="form-grid form-grid-2">
            <div className="form-group"><label className="form-label">Responsável</label><input className="form-control" {...f('responsible_name')} /></div>
            <div className="form-group"><label className="form-label">CPF do Responsável</label><input className="form-control" {...f('responsible_cpf')} placeholder="000.000.000-00" /></div>
          </div>
          <div className="form-grid form-grid-2">
            <div className="form-group"><label className="form-label">CEP</label><input className="form-control" {...f('cep')} placeholder="00000-000" /></div>
            <div className="form-group"><label className="form-label">Número</label><input className="form-control" {...f('number')} /></div>
          </div>
          <div className="form-group"><label className="form-label">Rua</label><input className="form-control" {...f('street')} /></div>
          <div className="form-group"><label className="form-label">Complemento</label><input className="form-control" {...f('complement')} /></div>
          <div className="form-grid form-grid-2">
            <div className="form-group"><label className="form-label">Telefone</label><input className="form-control" {...f('phone')} placeholder="(00) 00000-0000" /></div>
            <div className="form-group"><label className="form-label">Email</label><input className="form-control" type="email" {...f('email')} /></div>
          </div>
        </form>
      </Modal>
    </div>
  );
}
