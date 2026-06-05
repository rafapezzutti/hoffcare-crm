import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../services/api';
import Modal from '../components/Modal';
import { useAuth } from '../context/AuthContext';

const ROLE_LABELS = {
  admin:        { label: '👑 Master',       badge: 'badge-orange' },
  responsavel:  { label: 'Responsável',     badge: 'badge-blue'   },
  user:         { label: 'Usuário',         badge: 'badge-gray'   },
  recepcionista:{ label: 'Recepcionista',   badge: 'badge-gray'   },
  profissional: { label: '🩺 Profissional', badge: 'badge-green'  },
};

const PROF_TYPES = [
  { value: 'dentista',     label: 'Dentista (CRO)'   },
  { value: 'medico',       label: 'Médico (CRM)'     },
  { value: 'nutricionista',label: 'Nutricionista (CRN)' },
  { value: 'fisioterapeuta',label:'Fisioterapeuta (CREFITO)' },
  { value: 'psicologo',    label: 'Psicólogo (CRP)'  },
  { value: 'esteticista',  label: 'Esteticista'      },
  { value: 'outro',        label: 'Outro'            },
];

function PasswordField({ label, value, onChange, required }) {
  const [show, setShow] = useState(false);
  return (
    <div className="form-group">
      <label className="form-label">{label}</label>
      <div style={{ position: 'relative' }}>
        <input className="form-control" type={show ? 'text' : 'password'}
          value={value} onChange={onChange} required={required}
          placeholder="••••••••" autoComplete="new-password" style={{ paddingRight: 44 }} />
        <button type="button" onClick={() => setShow(v => !v)} tabIndex={-1}
          style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#6c757d', fontSize: 15, padding: 4 }}>
          <i className={`fas ${show ? 'fa-eye-slash' : 'fa-eye'}`} />
        </button>
      </div>
    </div>
  );
}

export default function Users() {
  const { t } = useTranslation();
  const { user: me } = useAuth();
  const isAdmin = me?.role === 'admin';
  const isResponsavel = me?.role === 'responsavel';

  const emptyForm = { name: '', email: '', password: '', role: isAdmin ? 'responsavel' : 'user', clinic_id: '', is_trial: false, professional_type: 'dentista' };

  const [items,           setItems]           = useState([]);
  const [clinics,         setClinics]         = useState([]);
  const [form,            setForm]            = useState(emptyForm);
  const [confirmPassword, setConfirmPassword] = useState('');
  const [editing,         setEditing]         = useState(null);
  const [open,            setOpen]            = useState(false);
  const [error,           setError]           = useState('');

  const load = async () => {
    const [u, c] = await Promise.all([
      api.get('/users'),
      isAdmin ? api.get('/clinics') : Promise.resolve({ data: [] }),
    ]);
    setItems(u.data);
    setClinics(c.data);
  };
  useEffect(() => { load(); }, []);

  const handleOpen = (item = null) => {
    setEditing(item);
    setForm(item
      ? { ...item, password: '', professional_type: item.professional_type || 'dentista' }
      : emptyForm);
    setConfirmPassword('');
    setError('');
    setOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault(); setError('');
    if (form.password || !editing) {
      if (form.password !== confirmPassword) { setError('As senhas não coincidem.'); return; }
      if (!form.password && !editing) { setError('Senha obrigatória.'); return; }
    }
    try {
      if (editing) await api.put(`/users/${editing.id}`, form);
      else         await api.post('/users', form);
      setOpen(false); load();
    } catch (err) { setError(err.response?.data?.error || 'Erro ao salvar'); }
  };

  const handleDelete = async (id) => {
    if (!confirm('Remover usuário?')) return;
    await api.delete(`/users/${id}`); load();
  };

  const f = (field) => ({ value: form[field] || '', onChange: e => setForm(p => ({ ...p, [field]: e.target.value })) });
  const passwordsMatch    = confirmPassword && form.password === confirmPassword;
  const passwordsMismatch = confirmPassword && form.password !== confirmPassword;

  // Roles disponíveis conforme quem está criando
  const availableRoles = isAdmin
    ? [
        { value: 'responsavel',   label: 'Responsável'   },
        { value: 'profissional',  label: '🩺 Profissional' },
        { value: 'user',          label: 'Usuário'        },
        { value: 'recepcionista', label: 'Recepcionista'  },
      ]
    : [
        { value: 'profissional',  label: '🩺 Profissional' },
        { value: 'user',          label: 'Usuário'         },
        { value: 'recepcionista', label: 'Recepcionista'   },
      ];

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('users.title')}</h1>
          <p className="page-subtitle">
            {isAdmin ? t('users.subtitle') : 'Usuários da sua clínica'}
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => handleOpen()}>
          <i className="fas fa-user-plus" /> Novo Usuário
        </button>
      </div>

      <div className="card">
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Email</th>
                <th>Perfil</th>
                {isAdmin && <th>Clínica</th>}
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && (
                <tr><td colSpan={isAdmin ? 5 : 4}>
                  <div className="empty-state"><i className="fas fa-users" /><p>Nenhum usuário</p></div>
                </td></tr>
              )}
              {items.map(u => {
                const trialExpired  = u.is_trial && u.trial_expires_at && new Date() > new Date(u.trial_expires_at);
                const trialDaysLeft = u.is_trial && u.trial_expires_at
                  ? Math.max(0, Math.ceil((new Date(u.trial_expires_at) - new Date()) / 86400000))
                  : null;
                const rl = ROLE_LABELS[u.role] || { label: u.role, badge: 'badge-gray' };
                const canEdit   = u.role !== 'admin' && !(isResponsavel && u.role === 'responsavel');
                const canDelete = canEdit;
                return (
                  <tr key={u.id}>
                    <td>
                      {u.name}
                      {u.is_trial && (
                        <span className={`badge ${trialExpired ? 'badge-red' : 'badge-orange'}`} style={{ marginLeft: 8, fontSize: 10 }}>
                          {trialExpired ? 'Trial Expirado' : `Trial (${trialDaysLeft}d)`}
                        </span>
                      )}
                    </td>
                    <td style={{ fontSize: 13, color: 'var(--gray-600)' }}>{u.email}</td>
                    <td><span className={`badge ${rl.badge}`}>{rl.label}</span></td>
                    {isAdmin && <td style={{ fontSize: 13 }}>{u.clinic_name || '—'}</td>}
                    <td>
                      <div className="table-actions">
                        {isAdmin && u.is_trial && (
                          <button className="btn btn-outline btn-sm" title="Converter para definitivo"
                            onClick={async () => { if (confirm(`Converter ${u.name} para definitivo?`)) { await api.post(`/users/${u.id}/convert-trial`); load(); } }}>
                            <i className="fas fa-user-check" />
                          </button>
                        )}
                        {canEdit && (
                          <button className="btn btn-outline btn-sm" onClick={() => handleOpen(u)}>
                            <i className="fas fa-pen" />
                          </button>
                        )}
                        {canDelete && (
                          <button className="btn btn-danger btn-sm" onClick={() => handleDelete(u.id)}>
                            <i className="fas fa-trash" />
                          </button>
                        )}
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
        title={editing ? 'Editar Usuário' : 'Novo Usuário'}
        footer={
          <>
            <button className="btn btn-outline" onClick={() => setOpen(false)}>Cancelar</button>
            <button className="btn btn-primary" onClick={handleSubmit} disabled={passwordsMismatch}>Salvar</button>
          </>
        }>
        {error && <div className="alert alert-error"><i className="fas fa-circle-exclamation" /> {error}</div>}
        <form onSubmit={handleSubmit}>

          <div className="form-group">
            <label className="form-label">Nome <span className="required">*</span></label>
            <input className="form-control" {...f('name')} required />
          </div>

          <div className="form-group">
            <label className="form-label">Email <span className="required">*</span></label>
            <input className="form-control" type="email" {...f('email')} required autoComplete="off" />
          </div>

          <PasswordField
            label={editing ? 'Nova senha (deixe em branco para manter)' : 'Senha *'}
            value={form.password || ''}
            onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
            required={!editing}
          />

          {(form.password || !editing) && (
            <div className="form-group">
              <label className="form-label">
                Confirmar senha
                {passwordsMatch   && <span style={{ marginLeft: 8, color: '#28a745', fontSize: 11 }}><i className="fas fa-check-circle" /> Iguais</span>}
                {passwordsMismatch && <span style={{ marginLeft: 8, color: '#dc3545', fontSize: 11 }}><i className="fas fa-times-circle" /> Diferentes</span>}
              </label>
              <input className="form-control" type="password"
                value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                placeholder="••••••••" required={!!form.password || !editing}
                style={{ borderColor: passwordsMismatch ? '#dc3545' : passwordsMatch ? '#28a745' : undefined }} />
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: form.role === 'profissional' ? '1fr 1fr' : (isAdmin ? '1fr 1fr' : '1fr'), gap: 12 }}>
            <div className="form-group">
              <label className="form-label">Perfil <span className="required">*</span></label>
              <select className="form-control" {...f('role')}>
                {availableRoles.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>

            {/* Tipo de profissional — só aparece quando role = profissional */}
            {form.role === 'profissional' && (
              <div className="form-group">
                <label className="form-label">Especialidade</label>
                <select className="form-control" value={form.professional_type || 'dentista'}
                  onChange={e => setForm(p => ({ ...p, professional_type: e.target.value }))}>
                  {PROF_TYPES.map(pt => <option key={pt.value} value={pt.value}>{pt.label}</option>)}
                </select>
              </div>
            )}

            {/* Clínica — só admin seleciona */}
            {isAdmin && form.role !== 'profissional' && (
              <div className="form-group">
                <label className="form-label">Clínica</label>
                <select className="form-control" value={form.clinic_id || ''}
                  onChange={e => setForm(p => ({ ...p, clinic_id: e.target.value }))}>
                  <option value="">— Selecione —</option>
                  {clinics.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            )}
            {isAdmin && form.role === 'profissional' && (
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label className="form-label">Clínica</label>
                <select className="form-control" value={form.clinic_id || ''}
                  onChange={e => setForm(p => ({ ...p, clinic_id: e.target.value }))}>
                  <option value="">— Selecione —</option>
                  {clinics.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            )}
          </div>

          {/* Aviso automático para Profissional */}
          {form.role === 'profissional' && !editing && (
            <div style={{ padding: '10px 14px', background: '#f0fdf4', borderRadius: 8, border: '1px solid #86efac', fontSize: 13, color: '#166534', marginTop: 4 }}>
              <i className="fas fa-circle-info" style={{ marginRight: 6 }} />
              Um cadastro de profissional será criado automaticamente para este usuário.
            </div>
          )}

          {/* Trial — só admin */}
          {isAdmin && !editing && (
            <div style={{ padding: '12px 16px', background: '#fffbeb', borderRadius: 8, border: '1px solid #fde68a', display: 'flex', alignItems: 'center', gap: 12, marginTop: 8 }}>
              <input type="checkbox" id="is_trial" checked={!!form.is_trial}
                onChange={e => setForm(p => ({ ...p, is_trial: e.target.checked }))} />
              <label htmlFor="is_trial" style={{ cursor: 'pointer', marginBottom: 0, fontSize: 14 }}>
                <strong>Usuário Trial</strong> — acesso gratuito por 10 dias.
              </label>
            </div>
          )}
        </form>
      </Modal>
    </div>
  );
}
