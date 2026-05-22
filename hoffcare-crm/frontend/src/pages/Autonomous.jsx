import { useState, useEffect } from 'react';
import api from '../services/api';
import Modal from '../components/Modal';

const empty = {
  type: 'odontologico', name: '', cpf: '', crm_cro: '',
  birthdate: '', email: '', phone: '', password: ''
};

function PasswordField({ label, value, onChange, required, placeholder }) {
  const [show, setShow] = useState(false);
  return (
    <div className="form-group">
      <label className="form-label">{label} {required && <span className="required">*</span>}</label>
      <div style={{ position: 'relative' }}>
        <input
          className="form-control"
          type={show ? 'text' : 'password'}
          value={value}
          onChange={onChange}
          placeholder={placeholder || '••••••••'}
          required={required}
          autoComplete="new-password"
          style={{ paddingRight: 44 }}
        />
        <button type="button" onClick={() => setShow(v => !v)}
          style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#6c757d', fontSize: 15 }}
          tabIndex={-1}>
          <i className={`fas ${show ? 'fa-eye-slash' : 'fa-eye'}`} />
        </button>
      </div>
    </div>
  );
}

export default function Autonomous() {
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const load = async () => {
    try {
      const res = await api.get('/autonomous');
      setItems(res.data);
    } catch {}
  };

  useEffect(() => { load(); }, []);

  const filtered = items.filter(i =>
    i.name.toLowerCase().includes(search.toLowerCase()) ||
    i.cpf?.includes(search) ||
    i.crm_cro?.toLowerCase().includes(search.toLowerCase()) ||
    i.login_email?.toLowerCase().includes(search.toLowerCase())
  );

  const handleOpen = (item = null) => {
    setEditing(item);
    setForm(item
      ? { ...item, email: item.login_email, birthdate: item.birthdate?.slice(0, 10) || '', password: '' }
      : empty
    );
    setError('');
    setOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (editing) await api.put(`/autonomous/${editing.clinic_id}`, form);
      else await api.post('/autonomous', form);
      setOpen(false);
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao salvar');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (clinicId, name) => {
    if (!confirm(`Remover o autônomo "${name}"?\n\nIsso apagará todos os dados, pacientes e agenda dele.`)) return;
    try {
      await api.delete(`/autonomous/${clinicId}`);
      load();
    } catch (err) {
      alert(err.response?.data?.error || 'Erro ao remover');
    }
  };

  const f = (field) => ({
    value: form[field] || '',
    onChange: e => setForm(p => ({ ...p, [field]: e.target.value }))
  });

  const typeLabel = { odontologico: '🦷 Dentista', medico: '🩺 Médico' };
  const typeBadge = { odontologico: 'badge-blue', medico: 'badge-orange' };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Profissionais Autônomos</h1>
          <p className="page-subtitle">Profissionais independentes com acesso próprio ao sistema</p>
        </div>
        <button className="btn btn-primary" onClick={() => handleOpen()}>
          <i className="fas fa-user-plus" /> Novo Autônomo
        </button>
      </div>

      {/* Info card */}
      <div style={{
        background: 'linear-gradient(135deg, #e8f4fd, #f0f9ff)',
        border: '1px solid #bee3f8', borderRadius: 8, padding: '14px 18px',
        display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 20
      }}>
        <i className="fas fa-circle-info" style={{ color: '#4DB8E8', fontSize: 16, marginTop: 2 }} />
        <div style={{ fontSize: 13, color: '#2d6a9f', lineHeight: 1.6 }}>
          Cada autônomo recebe <strong>login próprio</strong> e acessa o sistema de forma independente,
          com seus próprios pacientes, agenda e prontuários — sem interferência entre consultórios.
        </div>
      </div>

      <div className="card">
        <div className="search-bar">
          <div className="search-input-wrapper">
            <i className="fas fa-search" />
            <input className="form-control" placeholder="Buscar por nome, CPF, CRM/CRO ou e-mail..."
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Tipo</th>
                <th>Nome</th>
                <th>CPF</th>
                <th>CRM/CRO</th>
                <th>E-mail / Login</th>
                <th>Telefone</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={7}>
                  <div className="empty-state">
                    <i className="fas fa-user-doctor" />
                    <p>Nenhum profissional autônomo cadastrado</p>
                  </div>
                </td></tr>
              )}
              {filtered.map(p => (
                <tr key={p.clinic_id}>
                  <td>
                    <span className={`badge ${typeBadge[p.type] || 'badge-blue'}`}>
                      {typeLabel[p.type] || p.type}
                    </span>
                  </td>
                  <td><strong>{p.name}</strong></td>
                  <td>{p.cpf}</td>
                  <td><span style={{ fontFamily: 'monospace', fontSize: 12 }}>{p.crm_cro}</span></td>
                  <td>
                    <span style={{ fontSize: 12, color: 'var(--gray-600)' }}>
                      <i className="fas fa-envelope" style={{ marginRight: 5, color: '#4DB8E8' }} />
                      {p.login_email}
                    </span>
                  </td>
                  <td>{p.phone || '—'}</td>
                  <td>
                    <div className="table-actions">
                      <button className="btn btn-outline btn-sm" title="Editar" onClick={() => handleOpen(p)}>
                        <i className="fas fa-pen" />
                      </button>
                      <button className="btn btn-danger btn-sm" title="Remover" onClick={() => handleDelete(p.clinic_id, p.name)}>
                        <i className="fas fa-trash" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? `Editar — ${editing.name}` : 'Novo Profissional Autônomo'}
        footer={
          <>
            <button className="btn btn-outline" onClick={() => setOpen(false)}>Cancelar</button>
            <button className="btn btn-primary" onClick={handleSubmit} disabled={loading}>
              {loading ? 'Salvando...' : 'Salvar'}
            </button>
          </>
        }
      >
        {error && <div className="alert alert-error"><i className="fas fa-circle-exclamation" /> {error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Especialidade <span className="required">*</span></label>
            <select className="form-control" {...f('type')}>
              <option value="odontologico">🦷 Dentista</option>
              <option value="medico">🩺 Médico</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Nome Completo <span className="required">*</span></label>
            <input className="form-control" {...f('name')} required placeholder="Dr. João Silva" />
          </div>

          <div className="form-grid form-grid-2">
            <div className="form-group">
              <label className="form-label">CPF <span className="required">*</span></label>
              <input className="form-control" {...f('cpf')} placeholder="000.000.000-00" required />
            </div>
            <div className="form-group">
              <label className="form-label">
                {form.type === 'medico' ? 'CRM' : 'CRO'} <span className="required">*</span>
              </label>
              <input className="form-control" {...f('crm_cro')}
                placeholder={form.type === 'medico' ? 'CRM-SP 000000' : 'CRO-SP 000000'} required />
            </div>
          </div>

          <div className="form-grid form-grid-2">
            <div className="form-group">
              <label className="form-label">Data de Nascimento</label>
              <input className="form-control" type="date" {...f('birthdate')} />
            </div>
            <div className="form-group">
              <label className="form-label">Telefone</label>
              <input className="form-control" {...f('phone')} placeholder="(00) 00000-0000" />
            </div>
          </div>

          <div style={{ borderTop: '1px solid var(--gray-100)', paddingTop: 16, marginTop: 4 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>
              <i className="fas fa-key" style={{ marginRight: 6, color: '#4DB8E8' }} />
              Acesso ao Sistema
            </div>

            <div className="form-group">
              <label className="form-label">E-mail de Login <span className="required">*</span></label>
              <input className="form-control" type="email" {...f('email')}
                placeholder="profissional@email.com" required autoComplete="off" />
            </div>

            <PasswordField
              label={editing ? 'Nova Senha (deixe em branco para manter)' : 'Senha de Acesso'}
              value={form.password}
              onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
              required={!editing}
              placeholder={editing ? 'Deixe em branco para manter' : 'Mínimo 6 caracteres'}
            />

            {!editing && (
              <div style={{ fontSize: 11, color: 'var(--gray-400)', marginTop: -8 }}>
                O profissional usará este e-mail e senha para acessar o sistema em psaude.ia.br
              </div>
            )}
          </div>
        </form>
      </Modal>
    </div>
  );
}
