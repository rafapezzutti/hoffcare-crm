import { useState, useEffect } from 'react';
import api from '../services/api';
import Modal from '../components/Modal';

const empty = { name: '', email: '', password: '', role: 'responsavel', clinic_id: '' };

function PasswordField({ label, value, onChange, required, placeholder, autoComplete }) {
  const [show, setShow] = useState(false);
  return (
    <div className="form-group">
      <label className="form-label">{label}</label>
      <div style={{ position: 'relative' }}>
        <input
          className="form-control"
          type={show ? 'text' : 'password'}
          value={value}
          onChange={onChange}
          required={required}
          placeholder={placeholder || '••••••••'}
          autoComplete={autoComplete || 'new-password'}
          style={{ paddingRight: 44 }}
        />
        <button
          type="button"
          onClick={() => setShow(v => !v)}
          tabIndex={-1}
          style={{
            position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
            background: 'none', border: 'none', cursor: 'pointer', color: '#6c757d', fontSize: 15, padding: 4,
          }}
        >
          <i className={`fas ${show ? 'fa-eye-slash' : 'fa-eye'}`} />
        </button>
      </div>
    </div>
  );
}

export default function Users() {
  const [items, setItems] = useState([]);
  const [clinics, setClinics] = useState([]);
  const [form, setForm] = useState(empty);
  const [confirmPassword, setConfirmPassword] = useState('');
  const [editing, setEditing] = useState(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    const [u, c] = await Promise.all([api.get('/users'), api.get('/clinics')]);
    setItems(u.data); setClinics(c.data);
  };
  useEffect(() => { load(); }, []);

  const handleOpen = (item = null) => {
    setEditing(item);
    setForm(item ? { ...item, password: '' } : empty);
    setConfirmPassword('');
    setError(''); setOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault(); setError('');

    // Validação de confirmação de senha
    if (form.password || !editing) {
      if (form.password !== confirmPassword) {
        setError('As senhas não coincidem. Verifique e tente novamente.');
        return;
      }
      if (!form.password && !editing) {
        setError('A senha é obrigatória para novos usuários.');
        return;
      }
    }

    try {
      if (editing) await api.put(`/users/${editing.id}`, form);
      else await api.post('/users', form);
      setOpen(false); load();
    } catch (err) { setError(err.response?.data?.error || 'Erro ao salvar'); }
  };

  const handleDelete = async (id) => {
    if (!confirm('Remover usuário?')) return;
    await api.delete(`/users/${id}`); load();
  };

  const f = (field) => ({ value: form[field] || '', onChange: e => setForm(p => ({ ...p, [field]: e.target.value })) });

  const passwordsMatch = confirmPassword && form.password === confirmPassword;
  const passwordsMismatch = confirmPassword && form.password !== confirmPassword;

  return (
    <div className="page">
      <div className="page-header">
        <div><h1 className="page-title">Usuários do Sistema</h1><p className="page-subtitle">Gerenciar acessos</p></div>
        <button className="btn btn-primary" onClick={() => handleOpen()}><i className="fas fa-user-plus" /> Novo Usuário</button>
      </div>
      <div className="card">
        <div className="table-container">
          <table className="table">
            <thead><tr><th>Nome</th><th>Email</th><th>Perfil</th><th>Consultório</th><th>Ações</th></tr></thead>
            <tbody>
              {items.map(u => (
                <tr key={u.id}>
                  <td>{u.name}</td>
                  <td>{u.email}</td>
                  <td><span className={`badge ${u.role === 'admin' ? 'badge-orange' : 'badge-blue'}`}>{u.role === 'admin' ? 'Administrador' : 'Responsável'}</span></td>
                  <td>{u.clinic_name || '-'}</td>
                  <td><div className="table-actions">
                    <button className="btn btn-outline btn-sm" onClick={() => handleOpen(u)}><i className="fas fa-pen" /></button>
                    <button className="btn btn-danger btn-sm" onClick={() => handleDelete(u.id)}><i className="fas fa-trash" /></button>
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? 'Editar Usuário' : 'Novo Usuário'}
        footer={<><button className="btn btn-outline" onClick={() => setOpen(false)}>Cancelar</button><button className="btn btn-primary" onClick={handleSubmit} disabled={passwordsMismatch}>Salvar</button></>}>
        {error && <div className="alert alert-error"><i className="fas fa-circle-exclamation" /> {error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-group"><label className="form-label">Nome <span className="required">*</span></label><input className="form-control" {...f('name')} required /></div>
          <div className="form-group"><label className="form-label">Email <span className="required">*</span></label><input className="form-control" type="email" {...f('email')} required autoComplete="off" /></div>

          <PasswordField
            label={editing ? 'Nova senha (deixe em branco para manter)' : 'Senha *'}
            value={form.password || ''}
            onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
            required={!editing}
            autoComplete="new-password"
          />

          {/* Confirmação de senha — aparece quando há algo digitado */}
          {(form.password || !editing) && (
            <div className="form-group">
              <label className="form-label">
                Confirmar senha
                {passwordsMatch && <span style={{ marginLeft: 8, color: '#28a745', fontSize: 11 }}><i className="fas fa-check-circle" /> Senhas iguais</span>}
                {passwordsMismatch && <span style={{ marginLeft: 8, color: '#dc3545', fontSize: 11 }}><i className="fas fa-times-circle" /> Senhas diferentes</span>}
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  className="form-control"
                  type="password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  required={!!form.password || !editing}
                  style={{
                    paddingRight: 44,
                    borderColor: passwordsMismatch ? '#dc3545' : passwordsMatch ? '#28a745' : undefined,
                  }}
                />
              </div>
            </div>
          )}

          <div className="form-grid form-grid-2">
            <div className="form-group"><label className="form-label">Perfil <span className="required">*</span></label>
              <select className="form-control" {...f('role')}>
                <option value="responsavel">Responsável pelo Consultório</option>
                <option value="admin">Administrador</option>
              </select>
            </div>
            <div className="form-group"><label className="form-label">Consultório</label>
              <select className="form-control" value={form.clinic_id || ''} onChange={e => setForm(p => ({ ...p, clinic_id: e.target.value }))}>
                <option value="">— Selecione —</option>
                {clinics.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
}
