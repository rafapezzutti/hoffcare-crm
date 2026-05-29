import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../services/api';
import Modal from '../components/Modal';
import { formatPhone, formatCPF } from '../utils/format';
import { PROF_TYPES } from '../config/professionalTypes';
import { TIMEZONES } from '../utils/timezone';

const emptyClinic = {
  name: '', responsible_name: '', responsible_cpf: '', cep: '', street: '',
  number: '', complement: '', phone: '', email: '',
  email_confirmations: false, email_reminders: false, email_recall: false,
  whatsapp_enabled: false, whatsapp_confirm: false, whatsapp_reminder: false,
  whatsapp_cancel: false, whatsapp_reminder_hours: 24,
  timezone: 'America/Sao_Paulo',
  // autônomo
  is_autonomous: false,
  prof_type: 'medico', nationality: 'brasileiro',
  prof_cpf: '', crm_cro: '', birthdate: '', prof_phone: '',
  password: '',
};

const Toggle = ({ label, hint, checked, onChange }) => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--gray-100)' }}>
    <div>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--gray-700)' }}>{label}</div>
      <div style={{ fontSize: 11, color: 'var(--gray-400)', marginTop: 2 }}>{hint}</div>
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

function PasswordField({ value, onChange }) {
  const [show, setShow] = useState(false);
  return (
    <div style={{ position: 'relative' }}>
      <input className="form-control" type={show ? 'text' : 'password'}
        value={value} onChange={onChange} placeholder="••••••••" autoComplete="new-password"
        style={{ paddingRight: 44 }} />
      <button type="button" onClick={() => setShow(v => !v)} style={{
        position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
        background: 'none', border: 'none', cursor: 'pointer', color: '#6c757d', fontSize: 15
      }} tabIndex={-1}>
        <i className={`fas ${show ? 'fa-eye-slash' : 'fa-eye'}`} />
      </button>
    </div>
  );
}

export default function Clinics() {
  const { t } = useTranslation();
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(emptyClinic);
  const [editing, setEditing] = useState(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const [testPhone, setTestPhone] = useState('');
  const [testResult, setTestResult] = useState(null);
  const [testLoading, setTestLoading] = useState(false);

  const load = async () => {
    const res = await api.get('/clinics');
    setItems(res.data);
  };

  useEffect(() => { load(); }, []);

  const handleOpen = (item = null) => {
    setEditing(item);
    if (item) {
      setForm({
        ...emptyClinic,
        ...item,
        // mapear campos do profissional autônomo
        prof_type: item.prof_type || 'medico',
        prof_cpf: item.prof_cpf || '',
        crm_cro: item.crm_cro || '',
        birthdate: item.birthdate ? item.birthdate.split('T')[0] : '',
        prof_phone: item.prof_phone || '',
        password: '',
      });
    } else {
      setForm(emptyClinic);
    }
    setError('');
    setTestResult(null);
    setOpen(true);
  };

  const set = (field) => (val) => setForm(p => ({ ...p, [field]: val }));
  const f = (field) => ({ value: form[field] || '', onChange: e => setForm(p => ({ ...p, [field]: e.target.value })) });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      if (form.is_autonomous) {
        // Usa rota de autônomos
        if (editing) {
          await api.put(`/autonomous/${editing.id}`, {
            type: form.prof_type,
            name: form.name,
            cpf: form.prof_cpf,
            crm_cro: form.crm_cro,
            nationality: form.nationality,
            birthdate: form.birthdate,
            email: form.email,
            phone: form.phone || form.prof_phone,
            password: form.password,
            email_confirmations: form.email_confirmations,
            email_reminders: form.email_reminders,
            email_recall: form.email_recall,
          });
        } else {
          await api.post('/autonomous', {
            type: form.prof_type,
            name: form.name,
            cpf: form.prof_cpf,
            crm_cro: form.crm_cro,
            nationality: form.nationality,
            birthdate: form.birthdate,
            email: form.email,
            phone: form.phone || form.prof_phone,
            password: form.password,
            email_confirmations: form.email_confirmations,
            email_reminders: form.email_reminders,
            email_recall: form.email_recall,
          });
        }
      } else {
        if (editing) await api.put(`/clinics/${editing.id}`, form);
        else await api.post('/clinics', form);
      }
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

  const handleTest = async () => {
    if (!testPhone) return;
    setTestLoading(true); setTestResult(null);
    try {
      const res = await api.post('/whatsapp/test', { phone: testPhone, clinic_id: editing?.id });
      setTestResult({ ok: true, msg: res.data.message });
    } catch (err) {
      const data = err.response?.data;
      const msg = data?.detail ? `${data.error} — ${data.detail}` : (data?.error || 'Erro ao enviar');
      setTestResult({ ok: false, msg });
    } finally { setTestLoading(false); }
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('clinics.title')}</h1>
          <p className="page-subtitle">{t('clinics.subtitle')}</p>
        </div>
        <button className="btn btn-primary" onClick={() => handleOpen()}>
          <i className="fas fa-plus" /> {t('clinics.newClinic')}
        </button>
      </div>

      <div className="card">
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>{t('clinics.name')}</th>
                <th>Tipo</th>
                <th>{t('clinics.responsible')}</th>
                <th>{t('clinics.phone')}</th>
                <th>{t('clinics.email')}</th>
                <th>{t('clinics.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && (
                <tr><td colSpan={6}>
                  <div className="empty-state"><i className="fas fa-hospital" /><p>{t('clinics.empty')}</p></div>
                </td></tr>
              )}
              {items.map(c => (
                <tr key={c.id}>
                  <td><strong>{c.name}</strong></td>
                  <td>
                    {c.is_autonomous
                      ? <span className="badge badge-blue">Autônomo</span>
                      : <span className="badge badge-green">Consultório</span>}
                  </td>
                  <td>{c.is_autonomous ? c.prof_name || c.name : (c.responsible_name || '—')}</td>
                  <td>{formatPhone(c.phone)}</td>
                  <td>{c.email || '—'}</td>
                  <td>
                    <div className="table-actions">
                      <button className="btn btn-outline btn-sm" onClick={() => handleOpen(c)}>
                        <i className="fas fa-pen" />
                      </button>
                      <button className="btn btn-danger btn-sm" onClick={() => handleDelete(c.id)}>
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

      <Modal open={open} onClose={() => setOpen(false)}
        title={editing ? (editing.is_autonomous ? 'Editar Autônomo' : t('clinics.editClinic')) : t('clinics.newClinic')}
        footer={
          <><button className="btn btn-outline" onClick={() => setOpen(false)}>{t('clinics.cancel')}</button>
          <button className="btn btn-primary" onClick={handleSubmit}>{t('clinics.save')}</button></>
        }>
        {error && <div className="alert alert-error">{error}</div>}
        <form onSubmit={handleSubmit}>

          {/* Toggle Autônomo — só na criação */}
          {!editing && (
            <div style={{ marginBottom: 16, padding: '12px 16px', background: 'var(--gray-50)', borderRadius: 8, border: '1px solid var(--gray-200)' }}>
              <Toggle
                label="É profissional autônomo?"
                hint="Cria um consultório individual com login próprio vinculado ao profissional"
                checked={!!form.is_autonomous}
                onChange={v => setForm(p => ({ ...p, is_autonomous: v }))}
              />
            </div>
          )}

          {/* ── Dados principais ── */}
          <div className="form-group">
            <label className="form-label">{form.is_autonomous ? 'Nome do profissional' : t('clinics.name')} <span className="required">*</span></label>
            <input className="form-control" {...f('name')} required />
          </div>

          {/* ── Campos exclusivos de autônomo ── */}
          {form.is_autonomous && (
            <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 8, padding: 16, marginBottom: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#0369a1', marginBottom: 12 }}>
                <i className="fas fa-user-doctor" style={{ marginRight: 6 }} />Dados do Profissional
              </div>
              <div className="form-group">
                <label className="form-label" style={{ fontSize: 12 }}>Especialidade</label>
                <select className="form-control" value={form.prof_type}
                  onChange={e => setForm(p => ({ ...p, prof_type: e.target.value }))}>
                  {PROF_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label" style={{ fontSize: 12 }}>Nacionalidade</label>
                <select className="form-control" value={form.nationality}
                  onChange={e => setForm(p => ({ ...p, nationality: e.target.value }))}>
                  <option value="brasileiro">Brasileiro</option>
                  <option value="estrangeiro">Estrangeiro</option>
                </select>
              </div>
              <div className="form-grid form-grid-2">
                <div className="form-group">
                  <label className="form-label" style={{ fontSize: 12 }}>CPF {form.nationality === 'brasileiro' && <span className="required">*</span>}</label>
                  <input className="form-control" {...f('prof_cpf')} placeholder="000.000.000-00"
                    required={form.nationality === 'brasileiro'} />
                </div>
                <div className="form-group">
                  <label className="form-label" style={{ fontSize: 12 }}>CRM / CRO / Registro</label>
                  <input className="form-control" {...f('crm_cro')} placeholder="Opcional" />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label" style={{ fontSize: 12 }}>Data de nascimento</label>
                <input className="form-control" type="date" {...f('birthdate')} />
              </div>
              <div style={{ borderTop: '1px solid #bae6fd', marginTop: 8, paddingTop: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#0369a1', marginBottom: 8 }}>
                  <i className="fas fa-key" style={{ marginRight: 6 }} />Acesso ao sistema
                </div>
                <div className="form-group">
                  <label className="form-label" style={{ fontSize: 12 }}>E-mail de login <span className="required">*</span></label>
                  <input className="form-control" type="email" {...f('email')} required />
                </div>
                <div className="form-group">
                  <label className="form-label" style={{ fontSize: 12 }}>
                    Senha {editing ? '(deixe em branco para não alterar)' : <span className="required">*</span>}
                  </label>
                  <PasswordField value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} />
                </div>
              </div>
            </div>
          )}

          {/* ── Campos de consultório regular ── */}
          {!form.is_autonomous && (
            <>
              <div className="form-grid form-grid-2">
                <div className="form-group"><label className="form-label">{t('clinics.responsible')}</label><input className="form-control" {...f('responsible_name')} /></div>
                <div className="form-group"><label className="form-label">{t('clinics.responsibleCpf')}</label><input className="form-control" {...f('responsible_cpf')} placeholder="000.000.000-00" /></div>
              </div>
              <div className="form-grid form-grid-2">
                <div className="form-group"><label className="form-label">{t('clinics.cep')}</label><input className="form-control" {...f('cep')} placeholder="00000-000" /></div>
                <div className="form-group"><label className="form-label">{t('clinics.number')}</label><input className="form-control" {...f('number')} /></div>
              </div>
              <div className="form-group"><label className="form-label">{t('clinics.street')}</label><input className="form-control" {...f('street')} /></div>
              <div className="form-group"><label className="form-label">{t('clinics.complement')}</label><input className="form-control" {...f('complement')} /></div>
            </>
          )}

          {/* ── Contato (ambos) ── */}
          <div className="form-grid form-grid-2">
            <div className="form-group">
              <label className="form-label">{t('clinics.phone')}</label>
              <input className="form-control" {...f('phone')} placeholder="(00) 00000-0000" />
            </div>
            {!form.is_autonomous && (
              <div className="form-group">
                <label className="form-label">{t('clinics.email')} <span style={{ fontSize: 11, color: 'var(--gray-400)' }}>— notificações</span></label>
                <input className="form-control" type="email" {...f('email')} />
              </div>
            )}
          </div>

          {/* ── Fuso horário ── */}
          <div className="form-group" style={{ marginTop: 4 }}>
            <label className="form-label">
              <i className="fas fa-globe" style={{ marginRight: 6, color: '#6366f1' }} />
              Fuso horário (timezone)
            </label>
            <select className="form-control" value={form.timezone || 'America/Sao_Paulo'}
              onChange={e => setForm(p => ({ ...p, timezone: e.target.value }))}>
              {TIMEZONES.map(tz => (
                <option key={tz.value} value={tz.value}>{tz.label}</option>
              ))}
            </select>
            <div style={{ fontSize: 11, color: 'var(--gray-400)', marginTop: 4 }}>
              Define como os horários da agenda são exibidos para este consultório
            </div>
          </div>

          {/* ── Notificações e-mail ── */}
          <div className="form-group" style={{ marginTop: 8 }}>
            <label className="form-label" style={{ marginBottom: 8 }}>
              <i className="fas fa-envelope" style={{ marginRight: 6, color: '#4DB8E8' }} />
              {t('clinics.notifications')}
            </label>
            <Toggle label={t('clinics.emailConfirmations')} hint="E-mail ao paciente ao ser agendado com links confirmar/cancelar" checked={!!form.email_confirmations} onChange={set('email_confirmations')} />
            <Toggle label={t('clinics.emailReminders')} hint="Lembrete no dia anterior com opção de confirmar ou cancelar" checked={!!form.email_reminders} onChange={set('email_reminders')} />
            <Toggle label={t('clinics.emailRecall')} hint="E-mail após 6 meses sem consulta para remarcar" checked={!!form.email_recall} onChange={set('email_recall')} />
          </div>

          {/* ── WhatsApp (disponível para consultórios e autônomos) ── */}
          {(
            <div className="form-group" style={{ marginTop: 16 }}>
              <label className="form-label" style={{ marginBottom: 8 }}>
                <i className="fab fa-whatsapp" style={{ marginRight: 6, color: '#25D366' }} />
                Notificações via WhatsApp
              </label>
              <Toggle label="Habilitar WhatsApp" hint="Mensagens enviadas pelo número da Pezzutti Soluções via gateway compartilhado"
                checked={!!form.whatsapp_enabled} onChange={set('whatsapp_enabled')} />

              {form.whatsapp_enabled && (
                <>
                  <div style={{ marginTop: 12 }}>
                    <Toggle label="Confirmação de agendamento" hint="Mensagem ao paciente quando a consulta é agendada" checked={!!form.whatsapp_confirm} onChange={set('whatsapp_confirm')} />
                    <Toggle label="Lembrete de consulta" hint="Mensagem X horas antes da consulta" checked={!!form.whatsapp_reminder} onChange={set('whatsapp_reminder')} />
                    {form.whatsapp_reminder && (
                      <div style={{ padding: '8px 0 8px 16px', borderBottom: '1px solid var(--gray-100)' }}>
                        <label className="form-label" style={{ fontSize: 12 }}>Enviar lembrete quantas horas antes?</label>
                        <select className="form-control" style={{ width: 160, fontSize: 13 }} value={form.whatsapp_reminder_hours || 24}
                          onChange={e => setForm(p => ({ ...p, whatsapp_reminder_hours: Number(e.target.value) }))}>
                          <option value={1}>1 hora antes</option>
                          <option value={2}>2 horas antes</option>
                          <option value={6}>6 horas antes</option>
                          <option value={12}>12 horas antes</option>
                          <option value={24}>24 horas antes</option>
                          <option value={48}>48 horas antes</option>
                        </select>
                      </div>
                    )}
                    <Toggle label="Aviso de cancelamento" hint="Mensagem ao paciente quando a consulta é cancelada" checked={!!form.whatsapp_cancel} onChange={set('whatsapp_cancel')} />
                  </div>

                  <div style={{ marginTop: 16, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: 14 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#15803d', marginBottom: 8 }}>
                      <i className="fab fa-whatsapp" style={{ marginRight: 6 }} />Enviar mensagem de teste
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input className="form-control" style={{ fontSize: 13 }} placeholder="5511999999999" value={testPhone} onChange={e => setTestPhone(e.target.value)} />
                      <button type="button" className="btn btn-outline btn-sm"
                        style={{ whiteSpace: 'nowrap', borderColor: '#25D366', color: '#25D366' }}
                        onClick={handleTest} disabled={testLoading}>
                        {testLoading ? 'Enviando...' : 'Testar'}
                      </button>
                    </div>
                    {testResult && (
                      <div style={{ marginTop: 8, fontSize: 12, color: testResult.ok ? '#15803d' : '#dc2626', fontWeight: 600 }}>
                        {testResult.ok ? '✓' : '✗'} {testResult.msg}
                      </div>
                    )}
                    <div style={{ fontSize: 11, color: '#6b7280', marginTop: 6 }}>
                      Formato: <strong>5511999999999</strong> (DDI + DDD + número). Mensagem enviada pelo número da Pezzutti Soluções.
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </form>
      </Modal>
    </div>
  );
}
