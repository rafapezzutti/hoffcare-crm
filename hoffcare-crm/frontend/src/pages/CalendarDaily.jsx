import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../services/api';
import Modal from '../components/Modal';
import dayjs from 'dayjs';
import 'dayjs/locale/pt-br';
import { PROF_TYPES, getProfType } from '../config/professionalTypes';
dayjs.locale('pt-br');

const emptyForm = {
  type: 'medico', patient_id: '', professional_id: '', room_id: '',
  appointment_date: '', duration_minutes: 30, notes: '', status: 'pending_confirmation'
};

const DEFAULT_START_HOUR = 7;
const DEFAULT_END_HOUR = 20;

export default function CalendarDaily() {
  const { t } = useTranslation();
  const [date, setDate] = useState(dayjs().format('YYYY-MM-DD'));
  const [appointments, setAppointments] = useState([]);
  const [patients, setPatients] = useState([]);
  const [professionals, setProfessionals] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const [patientSearch, setPatientSearch] = useState('');

  const loadDay = async (d) => {
    const res = await api.get(`/appointments?start=${d}T00:00:00&end=${d}T23:59:59`);
    setAppointments(res.data);
  };

  useEffect(() => {
    loadDay(date);
    Promise.all([api.get('/patients'), api.get('/professionals'), api.get('/rooms')]).then(([p, pr, r]) => {
      setPatients(p.data); setProfessionals(pr.data); setRooms(r.data);
    });
  }, [date]);

  const filteredPatients = patients.filter(p =>
    patientSearch === '' || p.name.toLowerCase().includes(patientSearch.toLowerCase()) || p.cpf.includes(patientSearch)
  );

  const handleOpen = (apt = null, hour = null) => {
    setEditing(apt);
    if (apt) {
      setForm({ ...apt, appointment_date: dayjs(apt.appointment_date).format('YYYY-MM-DDTHH:mm') });
      setPatientSearch(apt.patient_name || '');
    } else {
      const dt = hour !== null ? `${date}T${String(hour).padStart(2, '0')}:00` : `${date}T08:00`;
      setForm({ ...emptyForm, appointment_date: dt });
      setPatientSearch('');
    }
    setError(''); setOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault(); setError('');
    try {
      if (editing) await api.put(`/appointments/${editing.id}`, form);
      else await api.post('/appointments', form);
      setOpen(false); loadDay(date);
    } catch (err) { setError(err.response?.data?.error || 'Erro ao salvar'); }
  };

  const handleDelete = async (id) => {
    if (!confirm('Remover consulta?')) return;
    await api.delete(`/appointments/${id}`); loadDay(date);
  };

  const f = (field) => ({ value: form[field] || '', onChange: e => setForm(p => ({ ...p, [field]: e.target.value })) });

  const getAptAtHour = (h) => appointments.filter(a => dayjs(a.appointment_date).hour() === h);

  // Grade de horas: sempre mostra 7h–20h, mas expande se houver consultas fora desse intervalo
  const aptHours = appointments.map(a => dayjs(a.appointment_date).hour());
  const startHour = aptHours.length > 0 ? Math.min(DEFAULT_START_HOUR, Math.min(...aptHours)) : DEFAULT_START_HOUR;
  const endHour   = aptHours.length > 0 ? Math.max(DEFAULT_END_HOUR,   Math.max(...aptHours)) : DEFAULT_END_HOUR;
  const hours = Array.from({ length: endHour - startHour + 1 }, (_, i) => i + startHour);

  const statusColor = {
    scheduled: 'badge-blue',
    pending_confirmation: 'badge-yellow',
    confirmed: 'badge-green',
    completed: 'badge-green',
    cancelled: 'badge-red'
  };
  const statusLabel = {
    scheduled: 'Agendado',
    pending_confirmation: 'Aguard. confirmação',
    confirmed: 'Confirmado',
    completed: 'Realizado',
    cancelled: 'Cancelado'
  };

  // Filtra profissionais e salas pelo tipo selecionado na agenda
  const filteredProfessionals = professionals.filter(p => p.type === form.type || form.type === '');
  const filteredRooms = rooms.filter(r => r.type === form.type || form.type === '');

  return (
    <div className="page">
      <div className="page-header">
        <div><h1 className="page-title">Agenda do Dia</h1><p className="page-subtitle">{dayjs(date).format('dddd, DD [de] MMMM [de] YYYY')}</p></div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button className="btn btn-outline" onClick={() => setDate(dayjs(date).subtract(1, 'day').format('YYYY-MM-DD'))}><i className="fas fa-chevron-left" /></button>
          <input type="date" className="form-control" value={date} onChange={e => setDate(e.target.value)} style={{ width: 160 }} />
          <button className="btn btn-outline" onClick={() => setDate(dayjs(date).add(1, 'day').format('YYYY-MM-DD'))}><i className="fas fa-chevron-right" /></button>
          <button className="btn btn-outline btn-sm" onClick={() => setDate(dayjs().format('YYYY-MM-DD'))}>{t('calendar.today')}</button>
          <button className="btn btn-primary" onClick={() => handleOpen()}><i className="fas fa-plus" /> {t('calendar.newAppointment')}</button>
        </div>
      </div>

      <div className="card">
        {hours.map(h => {
          const apts = getAptAtHour(h);
          return (
            <div key={h} style={{ display: 'flex', borderBottom: '1px solid var(--gray-100)', minHeight: 60 }}>
              <div style={{ width: 60, padding: '8px 12px', color: 'var(--gray-400)', fontSize: 12, fontWeight: 500, flexShrink: 0 }}>
                {String(h).padStart(2, '0')}:00
              </div>
              <div style={{ flex: 1, padding: '6px 8px', display: 'flex', flexWrap: 'wrap', gap: 8, cursor: 'pointer' }}
                onClick={() => apts.length === 0 && handleOpen(null, h)}>
                {apts.map(a => {
                  const t = getProfType(a.type);
                  return (
                    <div key={a.id} style={{
                      background: t.bg,
                      border: `1.5px solid ${t.border}`,
                      borderRadius: 8, padding: '6px 12px', minWidth: 200, cursor: 'pointer'
                    }} onClick={e => { e.stopPropagation(); handleOpen(a); }}>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{a.patient_name}</div>
                      <div style={{ fontSize: 11, color: 'var(--gray-500)' }}>{dayjs(a.appointment_date).format('HH:mm')} • {a.professional_name} • {a.room_name}</div>
                      <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                        <span className={`badge ${statusColor[a.status]}`} style={{ fontSize: 10 }}>{statusLabel[a.status]}</span>
                        <button className="btn btn-danger" style={{ padding: '2px 8px', fontSize: 11 }} onClick={e => { e.stopPropagation(); handleDelete(a.id); }}><i className="fas fa-trash" /></button>
                      </div>
                    </div>
                  );
                })}
                {apts.length === 0 && <div style={{ width: '100%', height: '100%' }} />}
              </div>
            </div>
          );
        })}
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? t('calendar.editAppointment') : t('calendar.newConsultation')} size="modal-lg"
        footer={<><button className="btn btn-outline" onClick={() => setOpen(false)}>{t('calendar.cancel')}</button><button className="btn btn-primary" onClick={handleSubmit}>{t('calendar.save')}</button></>}>
        {error && <div className="alert alert-error">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">{t('calendar.specialty')} <span className="required">*</span></label>
            <select className="form-control" {...f('type')} onChange={e => setForm(p => ({ ...p, type: e.target.value, professional_id: '', room_id: '' }))}>
              {PROF_TYPES.map(pt => (
                <option key={pt.value} value={pt.value}>{pt.emoji} {pt.labelKey ? t(pt.labelKey) : pt.label}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">{t('calendar.patient')} <span className="required">*</span></label>
            <input className="form-control" placeholder={t('calendar.searchPatient')} value={patientSearch} onChange={e => { setPatientSearch(e.target.value); setForm(p => ({ ...p, patient_id: '' })); }} />
            {patientSearch && !form.patient_id && (
              <div style={{ border: '1px solid var(--gray-200)', borderRadius: 6, maxHeight: 160, overflowY: 'auto', background: 'white', position: 'absolute', zIndex: 10, width: 490 }}>
                {filteredPatients.slice(0, 10).map(p => (
                  <div key={p.id} style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 13 }} onClick={() => { setForm(f => ({ ...f, patient_id: p.id })); setPatientSearch(p.name); }}
                    onMouseEnter={e => e.target.style.background = 'var(--gray-50)'} onMouseLeave={e => e.target.style.background = 'white'}>
                    {p.name} — {p.cpf}
                  </div>
                ))}
                {filteredPatients.length === 0 && <div style={{ padding: '8px 12px', color: 'var(--gray-400)', fontSize: 13 }}>{t('common.noData')}</div>}
              </div>
            )}
          </div>
          <div className="form-grid form-grid-2">
            <div className="form-group">
              <label className="form-label">Profissional <span className="required">*</span></label>
              <select className="form-control" {...f('professional_id')} required>
                <option value="">— Selecione —</option>
                {filteredProfessionals.map(p => (
                  <option key={p.id} value={p.id}>{p.name}{p.crm_cro ? ` (${p.crm_cro})` : ''}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Sala</label>
              <select className="form-control" {...f('room_id')}>
                <option value="">— Selecione —</option>
                {filteredRooms.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>
          </div>
          <div className="form-grid form-grid-2">
            <div className="form-group"><label className="form-label">Data e Hora <span className="required">*</span></label><input className="form-control" type="datetime-local" {...f('appointment_date')} required /></div>
            <div className="form-group"><label className="form-label">Duração (min)</label><input className="form-control" type="number" {...f('duration_minutes')} min={15} step={15} /></div>
          </div>
          {editing && (
            <div className="form-group"><label className="form-label">Status</label>
              <select className="form-control" {...f('status')}>
                <option value="scheduled">Agendado</option>
                <option value="pending_confirmation">Aguardando confirmação</option>
                <option value="confirmed">Confirmado</option>
                <option value="completed">Realizado</option>
                <option value="cancelled">Cancelado</option>
              </select>
            </div>
          )}
          <div className="form-group"><label className="form-label">Observações</label><textarea className="form-control" {...f('notes')} rows={2} /></div>
        </form>
      </Modal>
    </div>
  );
}
