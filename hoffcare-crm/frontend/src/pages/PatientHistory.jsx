import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import dayjs from 'dayjs';
import 'dayjs/locale/pt-br';
dayjs.locale('pt-br');

const EVENT_ICONS = {
  record:          { icon: 'fa-file-medical',    color: '#4DB8E8', bg: '#eff9ff' },
  anamnese:        { icon: 'fa-clipboard-check', color: '#34d399', bg: '#f0fdf4' },
  evolution:       { icon: 'fa-notes-medical',   color: '#f59e0b', bg: '#fffbeb' },
  tooth_procedure: { icon: 'fa-tooth',           color: '#8b5cf6', bg: '#faf5ff' },
  budget:          { icon: 'fa-file-invoice',    color: '#E8841A', bg: '#fff7ed' },
};

const FINANCIAL_ICONS = {
  record:     { icon: 'fa-file-medical',    color: '#4DB8E8' },
  odontogram: { icon: 'fa-tooth',           color: '#8b5cf6' },
  budget:     { icon: 'fa-file-invoice',    color: '#E8841A' },
};

export default function PatientHistory() {
  const { id: patientId } = useParams();
  const navigate = useNavigate();

  const [patient,   setPatient]   = useState(null);
  const [tab,       setTab]       = useState('tratamento'); // 'tratamento' | 'financeiro'
  const [timeline,  setTimeline]  = useState([]);
  const [financial, setFinancial] = useState({ items: [], total: 0 });
  const [loading,   setLoading]   = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [p, tl, fin] = await Promise.all([
          api.get(`/patients/${patientId}`),
          api.get(`/patients/${patientId}/timeline`),
          api.get(`/patients/${patientId}/financial`),
        ]);
        setPatient(p.data);
        setTimeline(tl.data);
        setFinancial(fin.data);
      } catch { }
      finally { setLoading(false); }
    };
    load();
  }, [patientId]);

  if (loading) return <div className="loading"><div className="spinner" /></div>;

  // Agrupa timeline por mês
  const grouped = timeline.reduce((acc, ev) => {
    const key = ev.date ? dayjs(ev.date).format('MMMM [de] YYYY') : 'Sem data';
    if (!acc[key]) acc[key] = [];
    acc[key].push(ev);
    return acc;
  }, {});

  return (
    <div className="page">
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="btn btn-outline btn-sm" onClick={() => navigate(`/patients/${patientId}`)}>
            <i className="fas fa-arrow-left" />
          </button>
          <div>
            <h1 className="page-title">
              <i className="fas fa-clock-rotate-left" style={{ marginRight: 8, color: '#4DB8E8' }} />
              Histórico
            </h1>
            {patient && <p className="page-subtitle">{patient.name}</p>}
          </div>
        </div>
      </div>

      {/* Abas */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 24, borderBottom: '2px solid var(--gray-200)' }}>
        {[
          { key: 'tratamento', label: 'Tratamento',  icon: 'fa-notes-medical' },
          { key: 'financeiro', label: 'Financeiro',  icon: 'fa-dollar-sign'   },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            style={{
              padding: '10px 24px', background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 14, fontWeight: tab === t.key ? 700 : 400,
              color: tab === t.key ? '#E8841A' : 'var(--gray-500)',
              borderBottom: `2px solid ${tab === t.key ? '#E8841A' : 'transparent'}`,
              marginBottom: -2,
              transition: 'all 0.15s',
            }}>
            <i className={`fas ${t.icon}`} style={{ marginRight: 6 }} />
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Aba Tratamento ── */}
      {tab === 'tratamento' && (
        <div style={{ maxWidth: 740, margin: '0 auto' }}>
          {timeline.length === 0 ? (
            <div className="card">
              <div className="empty-state">
                <i className="fas fa-clock-rotate-left" />
                <p>Nenhum evento registrado ainda.</p>
              </div>
            </div>
          ) : (
            Object.entries(grouped).map(([month, events]) => (
              <div key={month}>
                {/* Separador de mês */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '24px 0 16px' }}>
                  <div style={{ flex: 1, height: 1, background: 'var(--gray-200)' }} />
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: 1, whiteSpace: 'nowrap' }}>
                    {month}
                  </span>
                  <div style={{ flex: 1, height: 1, background: 'var(--gray-200)' }} />
                </div>

                {events.map((ev, i) => {
                  const cfg = EVENT_ICONS[ev.type] || EVENT_ICONS.record;
                  return (
                    <div key={i} style={{ display: 'flex', gap: 14, marginBottom: 14 }}>
                      {/* Ícone + linha vertical */}
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                        <div style={{ width: 36, height: 36, borderRadius: '50%', background: cfg.bg, border: `2px solid ${cfg.color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <i className={`fas ${cfg.icon}`} style={{ color: cfg.color, fontSize: 14 }} />
                        </div>
                        {i < events.length - 1 && (
                          <div style={{ width: 2, flex: 1, minHeight: 16, background: 'var(--gray-200)', marginTop: 4 }} />
                        )}
                      </div>

                      {/* Conteúdo */}
                      <div className="card" style={{ flex: 1, padding: '12px 16px', marginBottom: 0,
                        cursor: ev.link ? 'pointer' : 'default' }}
                        onClick={() => ev.link && navigate(ev.link)}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--gray-800)' }}>{ev.title}</div>
                            {ev.subtitle && <div style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 2 }}>{ev.subtitle}</div>}
                            {ev.detail && <div style={{ fontSize: 12, color: 'var(--gray-600)', marginTop: 4, fontStyle: 'italic' }}>{ev.detail}</div>}
                          </div>
                          <div style={{ textAlign: 'right', flexShrink: 0 }}>
                            <div style={{ fontSize: 12, color: 'var(--gray-400)' }}>
                              {ev.date ? dayjs(ev.date).format('DD/MM/YYYY') : '—'}
                            </div>
                            {ev.link && (
                              <i className="fas fa-arrow-right" style={{ fontSize: 10, color: cfg.color, marginTop: 4 }} />
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </div>
      )}

      {/* ── Aba Financeiro ── */}
      {tab === 'financeiro' && (
        <div style={{ maxWidth: 740, margin: '0 auto' }}>

          {/* Resumo */}
          <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
            <div style={{ flex: 1, padding: '16px 20px', background: '#f0fdf4', borderRadius: 12, border: '1px solid #86efac' }}>
              <div style={{ fontSize: 11, color: '#166534', fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>Total registrado</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: '#16a34a' }}>R$ {financial.total.toFixed(2)}</div>
            </div>
            <div style={{ flex: 1, padding: '16px 20px', background: '#f8f9fa', borderRadius: 12, border: '1px solid var(--gray-200)' }}>
              <div style={{ fontSize: 11, color: 'var(--gray-500)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>Transações</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--gray-800)' }}>{financial.items.length}</div>
            </div>
          </div>

          {/* Tabela */}
          {financial.items.length === 0 ? (
            <div className="card">
              <div className="empty-state">
                <i className="fas fa-dollar-sign" />
                <p>Nenhum registro financeiro encontrado.</p>
              </div>
            </div>
          ) : (
            <div className="card">
              <div className="table-container">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Data</th>
                      <th>Descrição</th>
                      <th>Profissional</th>
                      <th>Status</th>
                      <th style={{ textAlign: 'right' }}>Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {financial.items.map((item, i) => {
                      const cfg = FINANCIAL_ICONS[item.type] || FINANCIAL_ICONS.record;
                      return (
                        <tr key={i}>
                          <td style={{ whiteSpace: 'nowrap', fontSize: 13 }}>
                            {item.date ? dayjs(item.date).format('DD/MM/YYYY') : '—'}
                          </td>
                          <td style={{ fontSize: 13 }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <i className={`fas ${cfg.icon}`} style={{ color: cfg.color, fontSize: 12, flexShrink: 0 }} />
                              {item.description}
                            </span>
                          </td>
                          <td style={{ fontSize: 12, color: 'var(--gray-500)' }}>{item.professional || '—'}</td>
                          <td>
                            <span className={`badge ${item.status === 'pago' ? 'badge-green' : 'badge-blue'}`}>
                              {item.status === 'pago' ? 'Pago' : 'Parcial'}
                            </span>
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 700, color: '#16a34a', fontSize: 14 }}>
                            R$ {item.value.toFixed(2)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr style={{ background: 'var(--gray-50)', fontWeight: 700 }}>
                      <td colSpan={4} style={{ padding: '10px 16px', fontSize: 13 }}>Total</td>
                      <td style={{ padding: '10px 16px', textAlign: 'right', fontSize: 15, color: '#16a34a' }}>
                        R$ {financial.total.toFixed(2)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
