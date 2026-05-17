import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import 'dayjs/locale/pt-br';
import api from '../services/api';

dayjs.locale('pt-br');

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export default function CalendarMonthly() {
  const [currentMonth, setCurrentMonth] = useState(dayjs().startOf('month'));
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedDay, setSelectedDay] = useState(null);
  const navigate = useNavigate();

  const loadMonth = async (month) => {
    setLoading(true);
    try {
      const start = month.startOf('month').format('YYYY-MM-DD');
      const end = month.endOf('month').format('YYYY-MM-DD');
      const res = await api.get(`/appointments?start=${start}T00:00:00&end=${end}T23:59:59`);
      setAppointments(res.data || []);
    } catch (err) {
      console.error('Erro ao carregar consultas:', err);
      setAppointments([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadMonth(currentMonth); }, [currentMonth]);

  const prevMonth = () => setCurrentMonth(m => m.subtract(1, 'month'));
  const nextMonth = () => setCurrentMonth(m => m.add(1, 'month'));
  const goToday = () => setCurrentMonth(dayjs().startOf('month'));

  const startDay = currentMonth.startOf('month').day();
  const daysInMonth = currentMonth.daysInMonth();
  const today = dayjs();

  const cells = [];
  for (let i = 0; i < startDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const getAptsForDay = (day) => {
    if (!day) return [];
    const dateStr = currentMonth.date(day).format('YYYY-MM-DD');
    return appointments.filter(a =>
      dayjs(a.appointment_date).format('YYYY-MM-DD') === dateStr
    ).sort((a, b) => dayjs(a.appointment_date).diff(dayjs(b.appointment_date)));
  };

  const isToday = (day) => day && currentMonth.date(day).isSame(today, 'day');
  const isSelected = (day) => day && selectedDay === day;
  const selectedApts = selectedDay ? getAptsForDay(selectedDay) : [];

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Calendário Mensal</h1>
          <p className="page-subtitle">Visão geral de consultas</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-outline" onClick={() => navigate('/calendar/daily')}>
            <i className="fas fa-calendar-day" /> Agenda do Dia
          </button>
          <button className="btn btn-primary" onClick={() => navigate('/appointments/new')}>
            <i className="fas fa-plus" /> Nova Consulta
          </button>
        </div>
      </div>

      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <button className="btn btn-outline btn-sm" onClick={prevMonth}><i className="fas fa-chevron-left" /></button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, textTransform: 'capitalize', margin: 0 }}>
              {currentMonth.format('MMMM YYYY')}
            </h2>
            <button className="btn btn-outline btn-sm" onClick={goToday} style={{ fontSize: 11 }}>Hoje</button>
          </div>
          <button className="btn btn-outline btn-sm" onClick={nextMonth}><i className="fas fa-chevron-right" /></button>
        </div>

        <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
            <span style={{ width: 12, height: 12, background: 'var(--blue)', borderRadius: 3, display: 'inline-block' }} /> Dentista
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
            <span style={{ width: 12, height: 12, background: 'var(--orange)', borderRadius: 3, display: 'inline-block' }} /> Médico
          </span>
        </div>

        {loading ? (
          <div className="loading"><div className="spinner" /></div>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, marginBottom: 4 }}>
              {WEEKDAYS.map(d => (
                <div key={d} style={{ textAlign: 'center', fontSize: 11, fontWeight: 700, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: 1, padding: '4px 0' }}>{d}</div>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
              {cells.map((day, idx) => {
                const apts = day ? getAptsForDay(day) : [];
                const todayCell = isToday(day);
                const selectedCell = isSelected(day);
                return (
                  <div key={idx} onClick={() => day && setSelectedDay(day === selectedDay ? null : day)}
                    style={{
                      minHeight: 90, padding: '6px 4px', borderRadius: 6,
                      border: selectedCell ? '2px solid var(--blue)' : todayCell ? '2px solid var(--orange)' : '1px solid var(--gray-100)',
                      background: day ? (selectedCell ? 'rgba(77,184,232,0.08)' : 'var(--gray-50)') : 'transparent',
                      cursor: day ? 'pointer' : 'default',
                    }}>
                    {day && (
                      <>
                        <div style={{ fontSize: 13, fontWeight: todayCell ? 800 : 500, color: todayCell ? 'var(--orange)' : 'var(--gray-800)', marginBottom: 4, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span>{day}</span>
                          {apts.length > 0 && <span style={{ background: 'var(--blue)', color: 'white', borderRadius: 10, fontSize: 10, fontWeight: 700, padding: '1px 6px' }}>{apts.length}</span>}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                          {apts.slice(0, 3).map(a => (
                            <div key={a.id} title={`${dayjs(a.appointment_date).format('HH:mm')} - ${a.patient_name}`}
                              style={{ background: a.type === 'medico' ? 'var(--orange)' : 'var(--blue)', color: 'white', borderRadius: 3, fontSize: 10, padding: '2px 5px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {dayjs(a.appointment_date).format('HH:mm')} {a.patient_name}
                            </div>
                          ))}
                          {apts.length > 3 && <div style={{ fontSize: 10, color: 'var(--gray-500)', paddingLeft: 4 }}>+{apts.length - 3} mais</div>}
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {selectedDay && (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="card-header">
            <h2 style={{ fontSize: 16, fontWeight: 700 }}>
              {currentMonth.date(selectedDay).format('dddd, DD [de] MMMM')}
            </h2>
            <button className="btn btn-primary btn-sm" onClick={() => navigate('/calendar/daily')}>
              <i className="fas fa-calendar-day" /> Ver Agenda do Dia
            </button>
          </div>
          {selectedApts.length === 0 ? (
            <div className="empty-state" style={{ padding: '24px 0' }}>
              <i className="fas fa-calendar-xmark" /><p>Sem consultas neste dia</p>
            </div>
          ) : (
            <div className="table-container">
              <table className="table">
                <thead><tr><th>Horário</th><th>Paciente</th><th>Profissional</th><th>Tipo</th><th>Status</th></tr></thead>
                <tbody>
                  {selectedApts.map(a => (
                    <tr key={a.id}>
                      <td><strong>{dayjs(a.appointment_date).format('HH:mm')}</strong></td>
                      <td>{a.patient_name}</td>
                      <td>{a.professional_name}</td>
                      <td><span className={`badge ${a.type === 'medico' ? 'badge-orange' : 'badge-blue'}`}>{a.type === 'medico' ? '🩺 Médico' : '🦷 Odonto'}</span></td>
                      <td><span className={`badge ${a.status === 'confirmado' ? 'badge-blue' : a.status === 'cancelado' ? 'badge-danger' : 'badge-orange'}`}>{a.status || 'agendado'}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}