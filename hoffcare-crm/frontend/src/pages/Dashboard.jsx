import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import dayjs from 'dayjs';
import 'dayjs/locale/pt-br';
import { getProfType } from '../config/professionalTypes';
dayjs.locale('pt-br');

const MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

export default function Dashboard() {
  const [tab, setTab] = useState('overview');
  const [stats, setStats] = useState({ patients: 0, professionals: 0, appointments: 0, records: 0 });
  const [todayAppointments, setTodayAppointments] = useState([]);
  const navigate = useNavigate();

  // Controle mensal
  const now = dayjs();
  const [selYear, setSelYear] = useState(now.year());
  const [selMonth, setSelMonth] = useState(now.month() + 1); // 1-12
  const [monthly, setMonthly] = useState(null);
  const [loadingMonthly, setLoadingMonthly] = useState(false);

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

  useEffect(() => {
    if (tab !== 'monthly') return;
    setLoadingMonthly(true);
    api.get(`/records/monthly?year=${selYear}&month=${selMonth}`)
      .then(r => setMonthly(r.data))
      .catch(() => setMonthly(null))
      .finally(() => setLoadingMonthly(false));
  }, [tab, selYear, selMonth]);

  const cards = [
    { icon: 'fa-user-injured', label: 'Pacientes', value: stats.patients, color: 'blue', to: '/patients' },
    { icon: 'fa-user-md', label: 'Profissionais', value: stats.professionals, color: 'orange', to: '/professionals' },
    { icon: 'fa-calendar-check', label: 'Consultas Hoje', value: stats.appointments, color: 'green', to: '/calendar/daily' },
    { icon: 'fa-file-medical', label: 'Registros', value: stats.records, color: 'purple', to: '/records' },
  ];

  // Gera mini-barra para o gráfico de receita por dia
  const maxRevenue = monthly?.by_day?.length > 0
    ? Math.max(...monthly.by_day.map(d => parseFloat(d.revenue)))
    : 0;

  const daysInMonth = new Date(selYear, selMonth, 0).getDate();
  const dayRevMap = {};
  (monthly?.by_day || []).forEach(d => { dayRevMap[d.day] = d; });

  const years = [];
  for (let y = now.year(); y >= now.year() - 3; y--) years.push(y);

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

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '2px solid var(--gray-100)', paddingBottom: 0 }}>
        {[
          { key: 'overview', label: 'Visão Geral', icon: 'fa-chart-pie' },
          { key: 'monthly', label: 'Controle Mensal', icon: 'fa-chart-bar' },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            padding: '10px 18px', fontSize: 13, fontWeight: 600,
            color: tab === t.key ? 'var(--blue)' : 'var(--gray-500)',
            borderBottom: tab === t.key ? '2px solid var(--blue)' : '2px solid transparent',
            marginBottom: -2, transition: 'color 0.15s',
          }}>
            <i className={`fas ${t.icon}`} style={{ marginRight: 7 }} />{t.label}
          </button>
        ))}
      </div>

      {/* ── Tab: Visão Geral ── */}
      {tab === 'overview' && (
        <>
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
                  {todayAppointments.map(apt => {
                    const t = getProfType(apt.type);
                    return (
                      <div key={apt.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--gray-100)' }}>
                        <div style={{ width: 52, textAlign: 'center' }}>
                          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--gray-800)' }}>
                            {dayjs(apt.appointment_date).format('HH:mm')}
                          </div>
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 500 }}>{apt.patient_name}</div>
                          <div style={{ fontSize: 11, color: 'var(--gray-500)' }}>{apt.professional_name}{apt.room_name ? ` • ${apt.room_name}` : ''}</div>
                        </div>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: 4,
                          background: t.bg, color: t.color, border: `1px solid ${t.border}33`,
                          borderRadius: 4, padding: '2px 7px', fontSize: 11, fontWeight: 600
                        }}>{t.emoji} {t.short}</span>
                      </div>
                    );
                  })}
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
        </>
      )}

      {/* ── Tab: Controle Mensal ── */}
      {tab === 'monthly' && (
        <>
          {/* Seletor de mês/ano */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
            <button className="btn btn-outline btn-sm" onClick={() => {
              const d = dayjs(`${selYear}-${selMonth}-01`).subtract(1, 'month');
              setSelYear(d.year()); setSelMonth(d.month() + 1);
            }}><i className="fas fa-chevron-left" /></button>

            <select className="form-control" style={{ width: 140 }} value={selMonth}
              onChange={e => setSelMonth(Number(e.target.value))}>
              {MONTHS.map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
            </select>

            <select className="form-control" style={{ width: 90 }} value={selYear}
              onChange={e => setSelYear(Number(e.target.value))}>
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>

            <button className="btn btn-outline btn-sm" onClick={() => {
              const d = dayjs(`${selYear}-${selMonth}-01`).add(1, 'month');
              setSelYear(d.year()); setSelMonth(d.month() + 1);
            }}><i className="fas fa-chevron-right" /></button>

            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--gray-700)' }}>
              {MONTHS[selMonth - 1]} {selYear}
            </span>
          </div>

          {loadingMonthly ? (
            <div style={{ textAlign: 'center', padding: 60, color: 'var(--gray-400)' }}>
              <i className="fas fa-spinner fa-spin" style={{ fontSize: 28 }} />
            </div>
          ) : (
            <>
              {/* Cards de resumo */}
              <div className="stats-grid" style={{ marginBottom: 20 }}>
                <div className="stat-card">
                  <div className="stat-icon green"><i className="fas fa-dollar-sign" /></div>
                  <div>
                    <div className="stat-value" style={{ fontSize: 22 }}>
                      R$ {parseFloat(monthly?.total_revenue || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </div>
                    <div className="stat-label">Receita do Mês</div>
                  </div>
                </div>
                <div className="stat-card">
                  <div className="stat-icon blue"><i className="fas fa-file-medical" /></div>
                  <div>
                    <div className="stat-value">{monthly?.total_records || 0}</div>
                    <div className="stat-label">Atendimentos</div>
                  </div>
                </div>
                <div className="stat-card">
                  <div className="stat-icon orange"><i className="fas fa-list-check" /></div>
                  <div>
                    <div className="stat-value">{monthly?.total_procedures || 0}</div>
                    <div className="stat-label">Procedimentos</div>
                  </div>
                </div>
                <div className="stat-card">
                  <div className="stat-icon purple"><i className="fas fa-calculator" /></div>
                  <div>
                    <div className="stat-value" style={{ fontSize: 20 }}>
                      R$ {monthly?.total_records > 0
                        ? (parseFloat(monthly.total_revenue) / parseInt(monthly.total_records)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })
                        : '0,00'}
                    </div>
                    <div className="stat-label">Ticket Médio</div>
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20 }}>
                {/* Gráfico de barras por dia */}
                <div className="card">
                  <div className="card-header">
                    <span className="card-title"><i className="fas fa-chart-bar" style={{ color: 'var(--blue)', marginRight: 8 }} />Receita por Dia</span>
                  </div>
                  {maxRevenue === 0 ? (
                    <div className="empty-state" style={{ padding: 40 }}>
                      <i className="fas fa-chart-bar" />
                      <p>Sem dados para {MONTHS[selMonth - 1]}</p>
                    </div>
                  ) : (
                    <div style={{ overflowX: 'auto' }}>
                      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 140, padding: '0 4px 24px', minWidth: daysInMonth * 22 }}>
                        {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
                          const d = dayRevMap[day];
                          const rev = d ? parseFloat(d.revenue) : 0;
                          const h = maxRevenue > 0 ? Math.max(4, Math.round((rev / maxRevenue) * 110)) : 4;
                          return (
                            <div key={day} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, position: 'relative' }}>
                              <div
                                title={rev > 0 ? `Dia ${day}: R$ ${rev.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : `Dia ${day}: sem registros`}
                                style={{
                                  width: '100%', height: h,
                                  background: rev > 0 ? 'var(--blue)' : 'var(--gray-100)',
                                  borderRadius: '3px 3px 0 0', cursor: rev > 0 ? 'help' : 'default',
                                  transition: 'opacity 0.15s',
                                }}
                              />
                              <span style={{ fontSize: 9, color: 'var(--gray-400)', position: 'absolute', bottom: 0 }}>{day}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* Receita por especialidade */}
                <div className="card">
                  <div className="card-header">
                    <span className="card-title"><i className="fas fa-stethoscope" style={{ color: 'var(--orange)', marginRight: 8 }} />Por Especialidade</span>
                  </div>
                  {!monthly?.by_type?.length ? (
                    <div className="empty-state" style={{ padding: 30 }}>
                      <i className="fas fa-stethoscope" />
                      <p>Sem atendimentos</p>
                    </div>
                  ) : (
                    <div>
                      {monthly.by_type.map((item, i) => {
                        const t = getProfType(item.type);
                        const pct = maxRevenue > 0
                          ? Math.round((parseFloat(item.revenue) / parseFloat(monthly.total_revenue)) * 100)
                          : 0;
                        return (
                          <div key={i} style={{ padding: '10px 0', borderBottom: '1px solid var(--gray-100)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                              <span style={{ fontSize: 12, fontWeight: 600, color: t.color }}>
                                {t.emoji} {t.label}
                              </span>
                              <span style={{ fontSize: 12, color: 'var(--gray-600)' }}>
                                {item.records} atend.
                              </span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <div style={{ flex: 1, height: 6, background: 'var(--gray-100)', borderRadius: 3 }}>
                                <div style={{ width: `${pct}%`, height: '100%', background: t.color, borderRadius: 3 }} />
                              </div>
                              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--gray-700)', minWidth: 80, textAlign: 'right' }}>
                                R$ {parseFloat(item.revenue).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                              </span>
                            </div>
                          </div>
                        );
                      })}

                      <div style={{ marginTop: 12, paddingTop: 12, borderTop: '2px solid var(--gray-100)', display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--gray-700)' }}>Total</span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--success)' }}>
                          R$ {parseFloat(monthly?.total_revenue || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
