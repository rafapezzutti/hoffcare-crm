import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../services/api';
import Modal from '../components/Modal';
import { formatPhone } from '../utils/format';

const empty = {
  name: '', responsible_name: '', responsible_cpf: '', cep: '', street: '',
  number: '', complement: '', phone: '', email: '',
  email_confirmations: false, email_reminders: false, email_recall: false,
  whatsapp_enabled: false, whatsapp_confirm: false, whatsapp_reminder: false,
  whatsapp_cancel: false, whatsapp_reminder_hours: 24,
  whatsapp_instance_id: '', whatsapp_token: '', whatsapp_security_token: ''
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

export default function Clinics() {
  const { t } = useTranslation();
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(empty);
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
        <div><h1 className="page-title">{t('clinics.title')}</h1><p className="page-subtitle">{t('clinics.subtitle')}</p></div>
        <button className="btn btn-primary" onClick={() => handleOpen()}><i className="fas fa-plus" /> {t('clinics.newClinic')}</button>
      </div>

      <div className="card">
        <div className="table-container">
          <table className="table">
            <thead><tr><th>{t('clinics.name')}</th><th>{t('clinics.responsible')}</th><th>{t('clinics.phone')}</th><th>{t('clinics.email')}</th><th>{t('clinics.actions')}</th></tr></thead>
            <tbody>
              {items.length === 0 && <tr><td colSpan={5}><div className="empty-state"><i className="fas fa-hospital" /><p>{t('clinics.empty')}</p></div></td></tr>}
              {items.map(c => (
                <tr key={c.id}>
                  <td><strong>{c.name}</strong></td>
                  <td>{c.responsible_name || '-'}</td>
                  <td>{formatPhone(c.phone)}</td>
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

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? t('clinics.editClinic') : t('clinics.newClinic')}
        footer={<><button className="btn btn-outline" onClick={() => setOpen(false)}>{t('clinics.cancel')}</button><button className="btn btn-primary" onClick={handleSubmit}>{t('clinics.save')}</button></>}>
        {error && <div className="alert alert-error">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-group"><label className="form-label">{t('clinics.name')} <span className="required">*</span></label><input className="form-control" {...f('name')} required /></div>
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
          <div className="form-grid form-grid-2">
            <div className="form-group"><label className="form-label">{t('clinics.phone')}</label><input className="form-control" {...f('phone')} placeholder="(00) 00000-0000" /></div>
            <div className="form-group"><label className="form-label">{t('clinics.email')} <span style={{fontSize:11,color:'var(--gray-400)'}}>— usado para notificações</span></label><input className="form-control" type="email" {...f('email')} /></div>
          </div>

          {/* ── E-mail ── */}
          <div className="form-group" style={{ marginTop: 8 }}>
            <label className="form-label" style={{ marginBottom: 8 }}>
              <i className="fas fa-envelope" style={{ marginRight: 6, color: '#4DB8E8' }} />
              {t('clinics.notifications')}
            </label>
            <Toggle label={t('clinics.emailConfirmations')} hint="Paciente recebe e-mail ao ser agendado com links de confirmar/cancelar" checked={!!form.email_confirmations} onChange={v => setForm(p => ({ ...p, email_confirmations: v }))} />
            <Toggle label={t('clinics.emailReminders')} hint="Paciente recebe lembrete no dia anterior com opção de confirmar ou cancelar" checked={!!form.email_reminders} onChange={v => setForm(p => ({ ...p, email_reminders: v }))} />
            <Toggle label={t('clinics.emailRecall')} hint="Paciente recebe e-mail após 6 meses sem consulta para remarcar" checked={!!form.email_recall} onChange={v => setForm(p => ({ ...p, email_recall: v }))} />
          </div>

          {/* ── WhatsApp — temporariamente desabilitado ── */}
          <div className="form-group" style={{ marginTop: 16 }}>
            <label className="form-label" style={{ marginBottom: 8, opacity: 0.5 }}>
              <i className="fab fa-whatsapp" style={{ marginRight: 6, color: '#25D366' }} />
              Notificações via WhatsApp
            </label>

            <div style={{ pointerEvents: 'none', opacity: 0.45, userSelect: 'none' }}>
              <Toggle
                label="Habilitar WhatsApp"
                hint="Ativa o envio de mensagens pelo WhatsApp Business API"
                checked={false}
                onChange={() => {}}
              />

              <div style={{ background: 'var(--gray-50)', border: '1px solid var(--gray-200)', borderRadius: 8, padding: 16, marginTop: 12 }}>
                <div className="form-group" style={{ marginBottom: 12 }}>
                  <label className="form-label" style={{ fontSize: 12 }}>Instance ID <span style={{ color: 'var(--gray-400)', fontWeight: 400 }}>— obtido no painel Z-API</span></label>
                  <input className="form-control" style={{ fontSize: 13 }} placeholder="ex: 3ABC1D2E3F..." disabled value="" onChange={() => {}} />
                </div>
                <div className="form-group" style={{ marginBottom: 12 }}>
                  <label className="form-label" style={{ fontSize: 12 }}>Token <span style={{ color: 'var(--gray-400)', fontWeight: 400 }}>— token da instância (painel Z-API)</span></label>
                  <input className="form-control" style={{ fontSize: 13 }} type="password" placeholder="Cole o token aqui..." disabled value="" onChange={() => {}} />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontSize: 12 }}>Security Token <span style={{ color: 'var(--gray-400)', fontWeight: 400 }}>— Client-Token da sua conta Z-API</span></label>
                  <input className="form-control" style={{ fontSize: 13 }} type="password" placeholder="Cole o Security Token aqui..." disabled value="" onChange={() => {}} />
                </div>
              </div>

              <div style={{ marginTop: 12 }}>
                <Toggle label="Confirmação de agendamento" hint="Mensagem enviada ao paciente quando a consulta é agendada" checked={false} onChange={() => {}} />
                <Toggle label="Lembrete de consulta" hint="Mensagem enviada X horas antes da consulta" checked={false} onChange={() => {}} />
                <Toggle label="Aviso de cancelamento" hint="Mensagem enviada ao paciente quando a consulta é cancelada" checked={false} onChange={() => {}} />
              </div>
            </div>

            {/* Aviso de indisponibilidade */}
            <div style={{ marginTop: 12, background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 8, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
              <i className="fas fa-clock" style={{ color: '#f97316', fontSize: 14, flexShrink: 0 }} />
              <span style={{ fontSize: 12, color: '#9a3412' }}>
                <strong>Disponível em breve.</strong> A integração via WhatsApp está temporariamente desabilitada e será reativada em uma próxima atualização.
              </span>
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
}
