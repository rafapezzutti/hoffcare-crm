import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import dayjs from 'dayjs';

export default function Dashboard() {
  const [stats, setStats] = useState({ patients: 0, professionals: 0, appointments: 0, records: 0 });
  const [todayAppointments, setTodayAppointments] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    const today = dayjs().format('YYYY-MM-DD');
    Promise.all([
      api.get('/patients').catch(() => ({ data: [] })),
      api.get('/professionals').catch(() => ({ data: [] })),
      api.get(`/appointments?start=${today}T00:00:00&end=${today}T23:59:59`).catch(() => ({ data: [] })),
      api.get('/records').catch(() => ({ data: [] })),
    ]).then(([p, pr, a, r]) => {
      setStats({ patients: p.data.length, professionals: pr.data.length, appointments: a.data.length, records: r.data.length });
      setTodayAppointments(a.data.slice(0, 8));
    });
  }, []);

  const cards = [
    { icon: 'fa-user-injured', label: 'Pacientes', value: stats.patients, color: 'blue', to: '/patients' },
    { icon: 'fa-user-md', label: 'Profissionais', value: stats.professionals, color: 'orange', to: '/professionals' },
    { icon: 'fa-calendar-check', label: 'Consultas Hoje', value: stats.appointments, color: 'green', to: '/calendar/daily' },
    { icon: 'fa-file-medical', label: 'Registros', value: stats.records, color: 'purple', to: '/records' },
  ];

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">{dayjs().format('dddd, DD [de] MMMM [de] YYYY')}</p>
        </div>
        <button className="btn btn-primary" onClick={() => navigate('/records/new')}>
          <i className="fas fa-plus" /> Novo Registro
        </button>
      </div>

      <div className="stats-grid">
        {cards.map(c => (
          <div key={c.label} className="stat-card" onClick={() => navigate(c.to)} style={{ cursor: 'pointer' }}>
            <div className={`stat-icon ${c.color}`}><i className={`fas ${c.icon}`} /></div>
            <div>
              <div className="stat-value">{c.value}</div>
              <div className="stat-label">{c.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <div className="card">
          <div className="card-header">
            <span className="card-title"><i className="fas fa-calendar-day" style={{ color: 'var(--blue)', marginRight: 8 }} />Agenda de Hoje</span>
            <button className="btn btn-outline btn-sm" onClick={() => navigate('/calendar/daily')}>Ver tudo</button>
          </div>
          {todayAppointments.length === 0 ? (
            <div className="empty-state" style={{ padding: 30 }}>
              <i className="fas fa-calendar-xmark" />
              <p>Nenhuma consulta hoje</p>
            </div>
          ) : (
            <div>
              {todayAppointments.map(apt => (
                <div key={apt.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--gray-100)' }}>
                  <div style={{ width: 52, textAlign: 'center' }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--gray-800)' }}>
                      {dayjs(apt.appointment_date).format('HH:mm')}
                    </div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{apt.patient_name}</div>
                    <div style={{ fontSize: 11, color: 'var(--gray-500)' }}>{apt.professional_name} • {apt.room_name}</div>
                  </div>
                  <span className={`badge badge-${apt.type === 'medico' ? 'orange' : 'blue'}`}>
                    {apt.type === 'medico' ? 'Médico' : 'Dental'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <div className="card-header">
            <span className="card-title"><i className="fas fa-bolt" style={{ color: 'var(--orange)', marginRight: 8 }} />Ações Rápidas</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { label: 'Agendar Consulta', icon: 'fa-calendar-plus', to: '/calendar/daily', color: 'btn-secondary' },
              { label: 'Novo Paciente', icon: 'fa-user-plus', to: '/patients', color: 'btn-outline' },
              { label: 'Registrar Procedimento', icon: 'fa-file-medical', to: '/records/new', color: 'btn-primary' },
              { label: 'Histórico de Paciente', icon: 'fa-clock-rotate-left', to: '/history', color: 'btn-outline' },
            ].map(a => (
              <button key={a.to} className={`btn ${a.color}`} onClick={() => navigate(a.to)} style={{ justifyContent: 'flex-start' }}>
                <i className={`fas ${a.icon}`} /> {a.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
