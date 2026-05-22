import { useState, useEffect } from 'react';
import api from '../services/api';
import Modal from '../components/Modal';

const empty = {
  type: 'dentista', nationality: 'brasileiro',
  name: '', cpf: '', crm_cro: '',
  birthdate: '', email: '', phone: '', password: '',
  email_confirmations: false, email_reminders: false, email_recall: false
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

const Toggle = ({ label, hint, checked, onChange }) => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--gray-100)' }}>
    <div>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--gray-700)' }}>{label}</div>
      {hint && <div style={{ fontSize: 11, color: 'var(--gray-400)', marginTop: 2 }}>{hint}</div>}
    </div>
    <button type="button" onClick={() => onChange(!checked)} style={{
      width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer',
      background: checked ? '#28a745' : '#dee2e6', position: 'relative', flexShrink: 0, transition: 'background 0.2s'
    }}>
      <span style={{
        position: 'absolute', top: 3, left: checked ? 22 : 3,
        width: 18, height: 18, borderRadius: '50%', background: 'white',
        transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
      }} />
    </button>
  </div>
);

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
      ? {
          ...item,
          nationality: item.nationality || 'brasileiro',
          email: item.login_email,
          birthdate: item.birthdate?.slice(0, 10) || '',
          password: '',
          email_confirmations: item.email_confirmations ?? false,
          email_reminders: item.email_reminders ?? false,
          email_recall: item.email_recall ?? false,
        }
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

  const tog = (field) => ({
    checked: !!form[field],
    onChange: val => setForm(p => ({ ...p, [field]: val }))
  });

  const typeLabel = { dentista: '🦷 Dentista', odontologico: '🦷 Dentista', medico: '🩺 Médico' };
  const typeBadge = { dentista: 'badge-blue', odontologico: 'badge-blue', medico: 'badge-orange' };

  // Notif badges for table
  const notifIcons = (item) => {
    const icons = [];
    if (item.email_confirmations) icons.push(<i key="c" className="fas fa-envelope-circle-check" title="Confirmação" style={{ color: '#4DB8E8', fontSize: 11 }} />);
    if (item.email_reminders) icons.push(<i key="r" className="fas fa-bell" title="Lembrete 24h" style={{ color: '#E8841A', fontSize: 11 }} />);
    if (item.email_recall) icons.push(<i key="rc" className="fas fa-rotate-right" title="Recall 6 meses" style={{ color: '#28a745', fontSize: 11 }} />);
    return icons.length > 0
      ? <div style={{ display: 'flex', gap: 6, marginTop: 3 }}>{icons}</div>
      : <span style={{ fontSize: 11, color: 'var(--gray-300)' }}>—</span>;
  };

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
          As notificações por e-mail funcionam da mesma forma que nos consultórios convencionais.
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
                <th>Notificações</th>
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
                  <td>
                    <strong>{p.name}</strong>
                    {p.nationality === 'estrangeiro' && (
                      <span title="Profissional estrangeiro" style={{
                        marginLeft: 6, fontSize: 10, padding: '2px 6px', borderRadius: 4,
                        background: '#fffbea', color: '#744210', border: '1px solid #f6e05e',
                        verticalAlign: 'middle'
                      }}>🌎 Estrangeiro</span>
                    )}
                  </td>
                  <td>{p.cpf || <span style={{ color: 'var(--gray-300)' }}>—</span>}</td>
                  <td>
                    {p.crm_cro
                      ? <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{p.crm_cro}</span>
                      : <span style={{ color: 'var(--gray-300)' }}>—</span>}
                  </td>
                  <td>
                    <span style={{ fontSize: 12, color: 'var(--gray-600)' }}>
                      <i className="fas fa-envelope" style={{ marginRight: 5, color: '#4DB8E8' }} />
                      {p.login_email}
                    </span>
                  </td>
                  <td>{notifIcons(p)}</td>
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
          <div className="form-grid form-grid-2">
            <div className="form-group">
              <label className="form-label">Especialidade <span className="required">*</span></label>
              <select className="form-control" {...f('type')}>
                <option value="dentista">🦷 Dentista</option>
                <option value="medico">🩺 Médico</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Nacionalidade <span className="required">*</span></label>
              <select className="form-control" {...f('nationality')}>
                <option value="brasileiro">🇧🇷 Brasileiro</option>
                <option value="estrangeiro">🌎 Estrangeiro</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Nome Completo <span className="required">*</span></label>
            <input className="form-control" {...f('name')} required placeholder="Dr. João Silva" />
          </div>

          {form.nationality === 'estrangeiro' && (
            <div style={{
              background: '#fffbea', border: '1px solid #f6e05e', borderRadius: 6,
              padding: '8px 12px', marginBottom: 12, fontSize: 12, color: '#744210'
            }}>
              <i className="fas fa-circle-info" style={{ marginRight: 6 }} />
              Para profissionais estrangeiros, CPF e CRM/CRO são opcionais.
            </div>
          )}

          <div className="form-grid form-grid-2">
            <div className="form-group">
              <label className="form-label">
                CPF {form.nationality === 'brasileiro' && <span className="required">*</span>}
              </label>
              <input className="form-control" {...f('cpf')} placeholder="000.000.000-00"
                required={form.nationality === 'brasileiro'} />
            </div>
            <div className="form-group">
              <label className="form-label">
                {form.type === 'medico' ? 'CRM' : 'CRO'}
                {form.nationality === 'brasileiro' && <span className="required">*</span>}
              </label>
              <input className="form-control" {...f('crm_cro')}
                placeholder={form.type === 'medico' ? 'CRM-SP 000000' : 'CRO-SP 000000'}
                required={form.nationality === 'brasileiro'} />
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

          {/* Notificações */}
          <div style={{ borderTop: '1px solid var(--gray-100)', paddingTop: 16, marginTop: 4 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>
              <i className="fas fa-bell" style={{ marginRight: 6, color: '#E8841A' }} />
              Notificações por E-mail
            </div>
            <div style={{ fontSize: 11, color: 'var(--gray-400)', marginBottom: 12 }}>
              O e-mail do profissional receberá os avisos de cancelamento quando ativado.
            </div>
            <Toggle
              label="Confirmação de consulta"
              hint="E-mail enviado ao paciente no momento do agendamento"
              {...tog('email_confirmations')}
            />
            <Toggle
              label="Lembrete 24h antes"
              hint="E-mail com link para confirmar ou cancelar a consulta"
              {...tog('email_reminders')}
            />
            <Toggle
              label="Recall após 6 meses"
              hint="Lembrete automático para agendar nova consulta"
              {...tog('email_recall')}
            />
          </div>

          {/* Acesso ao Sistema */}
          <div style={{ borderTop: '1px solid var(--gray-100)', paddingTop: 16, marginTop: 4 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>
              <i className="fas fa-key" style={{ marginRight: 6, color: '#4DB8E8' }} />
              Acesso ao Sistema
            </div>

            <div className="form-group">
              <label className="form-label">E-mail de Login <span className="required">*</span></label>
              <input className="form-control" type="email" {...f('email')}
                placeholder="profissional@email.com" required autoComplete="off" />
              <div style={{ fontSize: 11, color: 'var(--gray-400)', marginTop: 4 }}>
                Usado para login e para receber avisos de cancelamento
              </div>
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
