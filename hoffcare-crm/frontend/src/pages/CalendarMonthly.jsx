import { useState, useEffect } from 'react';
import { Calendar, dateFnsLocalizer } from 'react-big-calendar';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import dayjs from 'dayjs';
import api from '../services/api';
import { useNavigate } from 'react-router-dom';

// Simple localizer using dayjs
const formats = {
  dateFormat: 'DD',
  dayFormat: 'DD ddd',
  weekdayFormat: 'ddd',
  timeGutterFormat: 'HH:mm',
  eventTimeRangeFormat: ({ start, end }) =>
    `${dayjs(start).format('HH:mm')} – ${dayjs(end).format('HH:mm')}`,
  monthHeaderFormat: 'MMMM YYYY',
};

const messages = {
  today: 'Hoje', previous: '‹', next: '›',
  month: 'Mês', week: 'Semana', day: 'Dia', agenda: 'Agenda',
  noEventsInRange: 'Sem consultas neste período.',
};

export default function CalendarMonthly() {
  const [appointments, setAppointments] = useState([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const navigate = useNavigate();

  const loadMonth = async (date) => {
    const start = dayjs(date).startOf('month').format('YYYY-MM-DD');
    const end = dayjs(date).endOf('month').format('YYYY-MM-DD');
    const res = await api.get(`/appointments?start=${start}T00:00:00&end=${end}T23:59:59`);
    const events = res.data.map(a => ({
      id: a.id,
      title: `${dayjs(a.appointment_date).format('HH:mm')} ${a.patient_name} - ${a.professional_name}`,
      start: new Date(a.appointment_date),
      end: dayjs(a.appointment_date).add(a.duration_minutes || 30, 'minute').toDate(),
      resource: a,
    }));
    setAppointments(events);
  };

  useEffect(() => { loadMonth(currentDate); }, [currentDate]);

  const eventStyle = (event) => ({
    style: {
      backgroundColor: event.resource.type === 'medico' ? 'var(--orange)' : 'var(--blue)',
      borderRadius: 4, border: 'none', fontSize: 11, padding: '2px 6px',
    }
  });

  return (
    <div className="page">
      <div className="page-header">
        <div><h1 className="page-title">Calendário Mensal</h1><p className="page-subtitle">Visão geral de consultas</p></div>
        <button className="btn btn-primary" onClick={() => navigate('/calendar/daily')}><i className="fas fa-calendar-day" /> Agenda do Dia</button>
      </div>

      <div className="card" style={{ minHeight: 600 }}>
        <div style={{ marginBottom: 12, display: 'flex', gap: 12 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
            <span style={{ width: 12, height: 12, background: 'var(--blue)', borderRadius: 3, display: 'inline-block' }} /> Dentista
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
            <span style={{ width: 12, height: 12, background: 'var(--orange)', borderRadius: 3, display: 'inline-block' }} /> Médico
          </span>
        </div>

        <Calendar
          localizer={{
            format: (value, formatStr) => dayjs(value).format(formatStr),
            formats,
            startOfWeek: () => 0,
            getRange: () => {},
            inRange: (day, min, max) => dayjs(day).isBetween(min, max, null, '[]'),
            lt: (a, b) => dayjs(a).isBefore(b),
            lte: (a, b) => !dayjs(a).isAfter(b),
            gt: (a, b) => dayjs(a).isAfter(b),
            gte: (a, b) => !dayjs(a).isBefore(b),
            eq: (a, b) => dayjs(a).isSame(b),
            neq: (a, b) => !dayjs(a).isSame(b),
            merge: (d, t) => dayjs(d).hour(dayjs(t).hour()).minute(dayjs(t).minute()).toDate(),
            add: (d, n, u) => dayjs(d).add(n, u).toDate(),
            range: (s, e) => { const r = []; let c = dayjs(s); while (c.isBefore(dayjs(e).add(1, 'day'))) { r.push(c.toDate()); c = c.add(1, 'day'); } return r; },
            diff: (a, b, u) => dayjs(a).diff(b, u),
            ceil: (d, u) => dayjs(d).endOf(u).toDate(),
            floor: (d, u) => dayjs(d).startOf(u).toDate(),
            min: (v) => new Date(Math.min(...v.map(d => d.getTime()))),
            max: (v) => new Date(Math.max(...v.map(d => d.getTime()))),
            minutes: (d) => d.getMinutes(),
            firstOfWeek: () => 0,
            firstVisibleDay: (d) => dayjs(d).startOf('month').startOf('week').toDate(),
            lastVisibleDay: (d) => dayjs(d).endOf('month').endOf('week').toDate(),
            visibleDays: (d) => {
              const start = dayjs(d).startOf('month').startOf('week');
              const end = dayjs(d).endOf('month').endOf('week');
              const days = [];
              let c = start;
              while (c.isBefore(end.add(1, 'day'))) { days.push(c.toDate()); c = c.add(1, 'day'); }
              return days;
            },
          }}
          events={appointments}
          defaultView="month"
          date={currentDate}
          onNavigate={setCurrentDate}
          eventPropGetter={eventStyle}
          messages={messages}
          onSelectEvent={e => navigate('/calendar/daily')}
          style={{ height: 600 }}
          culture="pt-BR"
        />
      </div>
    </div>
  );
}
