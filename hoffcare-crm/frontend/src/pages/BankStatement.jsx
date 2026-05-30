import { useState, useEffect } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import dayjs from 'dayjs';

const MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const fmt = (v) => `R$ ${parseFloat(v || 0).toFixed(2).replace('.',',').replace(/\B(?=(\d{3})+(?!\d))/g,'.')}`;

const Row = ({ cells, bold, bg }) => (
  <tr style={{ background: bg || 'white' }}>
    {cells.map((c, i) => (
      <td key={i} style={{ padding: '7px 12px', fontSize: 13, fontWeight: bold ? 700 : 400,
        textAlign: i > 0 ? 'right' : 'left', borderBottom: '1px solid var(--gray-100)',
        color: bold ? 'var(--gray-900)' : 'var(--gray-700)' }}>
        {c}
      </td>
    ))}
  </tr>
);

const SummaryCard = ({ label, value, color }) => (
  <div style={{ background: 'white', border: '1px solid var(--gray-200)', borderRadius: 10,
    padding: '14px 18px', flex: 1, minWidth: 140 }}>
    <div style={{ fontSize: 11, color: 'var(--gray-400)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</div>
    <div style={{ fontSize: 20, fontWeight: 800, color: color || 'var(--gray-900)', marginTop: 4 }}>{value}</div>
  </div>
);

export default function BankStatement() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState('consolidated'); // 'consolidated' | prof_id
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailResult, setEmailResult] = useState(null);

  const load = async () => {
    setLoading(true); setData(null); setEmailResult(null);
    try {
      const res = await api.get(`/settlements/bank-statement?year=${year}&month=${month}`);
      setData(res.data);
      setTab('consolidated');
    } catch (err) {
      alert(err.response?.data?.error || 'Erro ao carregar extrato');
    } finally { setLoading(false); }
  };

  const loadAdmin = async () => {
    if (!isAdmin) return;
    try {
      const res = await api.get(`/settlements/admin-report?year=${year}&month=${month}`);
      setAdminData(res.data);
    } catch {}
  };

  const handleExport = () => {
    const base = (import.meta.env.VITE_API_URL || '/api').replace(/\/api$/, '');
    const token = localStorage.getItem('psaude_token');
    const clinic = localStorage.getItem('psaude_clinic');
    let clinicId = '';
    try { clinicId = JSON.parse(clinic)?.id || ''; } catch {}
    window.open(`${base}/api/settlements/bank-statement/export?year=${year}&month=${month}&token_header=${encodeURIComponent(token)}&clinic_id=${clinicId}`, '_blank');
  };

  const handleSendEmail = async (prof) => {
    if (!prof?.email) { alert('Profissional sem e-mail cadastrado.'); return; }
    setEmailLoading(true); setEmailResult(null);
    try {
      await api.post(`/settlements/statement/${prof.professional_id}/send-email`, {
        html: buildEmailHtml(prof),
        year, month,
        professional_name: prof.professional_name,
        professional_email: prof.email || prof.professional_email,
      });
      setEmailResult({ ok: true, msg: `E-mail enviado para ${prof.professional_email || prof.email}` });
    } catch(err) {
      setEmailResult({ ok: false, msg: err.response?.data?.error || 'Erro ao enviar' });
    } finally { setEmailLoading(false); }
  };

  const buildEmailHtml = (prof) => {
    const rows = (prof.daily_rows || []).map(r =>
      `<tr><td style="padding:6px 12px;border-bottom:1px solid #eee">${r.day}</td>
       <td style="padding:6px 12px;border-bottom:1px solid #eee;text-align:right">${r.count}</td>
       <td style="padding:6px 12px;border-bottom:1px solid #eee;text-align:right">${fmt(r.gross)}</td>
       <td style="padding:6px 12px;border-bottom:1px solid #eee;text-align:right">${fmt(r.repasse)}</td>
       <td style="padding:6px 12px;border-bottom:1px solid #eee;text-align:right">${fmt(r.settlements_in)}</td>
       <td style="padding:6px 12px;border-bottom:1px solid #eee;text-align:right;color:${r.net>=0?'#1e8449':'#c0392b'}">${fmt(r.net)}</td></tr>`
    ).join('');
    return `<div style="font-family:Arial,sans-serif;max-width:680px;margin:0 auto">
      <div style="background:#1a2535;padding:20px;text-align:center">
        <div style="color:#4DB8E8;font-size:20px;font-weight:800">P. Soluções para Saúde</div>
        <div style="color:#E8841A;font-size:13px;font-weight:600">Extrato Mensal — ${MONTHS[month-1]}/${year}</div>
      </div>
      <div style="background:#f8f9fa;padding:16px 24px;border-bottom:2px solid #4DB8E8">
        <strong>${prof.professional_name}</strong> — Repasse: ${prof.repasse_percent}%
      </div>
      <table style="width:100%;border-collapse:collapse;font-size:13px">
        <thead><tr style="background:#D6EAF8">
          <th style="padding:8px 12px;text-align:left">Data</th>
          <th style="padding:8px 12px;text-align:right">Atend.</th>
          <th style="padding:8px 12px;text-align:right">Bruto</th>
          <th style="padding:8px 12px;text-align:right">Repasse</th>
          <th style="padding:8px 12px;text-align:right">Acertos+</th>
          <th style="padding:8px 12px;text-align:right">Líquido</th>
        </tr></thead>
        <tbody>${rows}</tbody>
        <tfoot><tr style="background:#1E8449;color:white;font-weight:700">
          <td style="padding:10px 12px" colspan="2">TOTAL</td>
          <td style="padding:10px 12px;text-align:right">${fmt(prof.gross)}</td>
          <td style="padding:10px 12px;text-align:right">${fmt(prof.repasse)}</td>
          <td style="padding:10px 12px;text-align:right">${fmt(prof.settlements_in)}</td>
          <td style="padding:10px 12px;text-align:right">${fmt(prof.net)}</td>
        </tr></tfoot>
      </table>
    </div>`;
  };

  const currentProf = tab !== 'consolidated' ? data?.by_professional?.find(p => String(p.professional_id) === String(tab)) : null;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title"><i className="fas fa-file-invoice-dollar" style={{ marginRight: 8, color: 'var(--blue)' }} />Extrato Mensal</h1>
          <p className="page-subtitle">Visão financeira detalhada por dia, estilo extrato bancário</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Mês</label>
            <select className="form-control" value={month} onChange={e => setMonth(Number(e.target.value))} style={{ width: 160 }}>
              {MONTHS.map((n, i) => <option key={i+1} value={i+1}>{n}</option>)}
            </select>
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Ano</label>
            <select className="form-control" value={year} onChange={e => setYear(Number(e.target.value))} style={{ width: 100 }}>
              {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <button className="btn btn-primary" onClick={load} disabled={loading}>
            <i className="fas fa-search" style={{ marginRight: 6 }} />{loading ? 'Carregando...' : 'Gerar Extrato'}
          </button>
          {data && (
            <button className="btn btn-outline" onClick={handleExport} title="Exportar Excel">
              <i className="fas fa-file-excel" style={{ marginRight: 6, color: '#1e8449' }} />Excel
            </button>
          )}
            {isAdmin && (
              <button onClick={() => setTab('admin')} style={{
                padding: '8px 18px', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
                borderBottom: tab === 'admin' ? '2px solid #7d3c98' : '2px solid transparent',
                color: tab === 'admin' ? '#7d3c98' : 'var(--gray-500)', background: 'none', marginBottom: -2
              }}>
                <i className="fas fa-crown" style={{ marginRight: 6 }} />Admin — Todas as Clínicas
              </button>
            )}
        </div>
      </div>

      {data && (
        <>
          {/* Cards resumo */}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
            <SummaryCard label="Receita Bruta" value={fmt(data.totals.gross)} color="#1a5276" />
            {data.totals.aesthetics_gross > 0 && <SummaryCard label="Estética Facial" value={fmt(data.totals.aesthetics_gross)} color="#e91e8c" />}
            <SummaryCard label="Repasse Profissionais" value={fmt(data.totals.repasse)} color="#7d3c98" />
            <SummaryCard label="Acertos Entrada" value={fmt(data.totals.settlements_in)} color="#1e8449" />
            <SummaryCard label="Acertos Saída" value={fmt(data.totals.settlements_out)} color="#c0392b" />
            {data.totals.rentals > 0 && <SummaryCard label="Aluguéis" value={fmt(data.totals.rentals)} color="#e67e22" />}
            <SummaryCard label="Líquido da Clínica" value={fmt(data.totals.net)} color={data.totals.net >= 0 ? '#1e8449' : '#c0392b'} />
          </div>

          {/* Abas */}
          <div style={{ display: 'flex', gap: 4, marginBottom: 0, borderBottom: '2px solid var(--gray-200)', flexWrap: 'wrap' }}>
            <button onClick={() => setTab('consolidated')} style={{
              padding: '8px 18px', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
              borderBottom: tab === 'consolidated' ? '2px solid #2E86C1' : '2px solid transparent',
              color: tab === 'consolidated' ? '#2E86C1' : 'var(--gray-500)', background: 'none', marginBottom: -2
            }}>
              <i className="fas fa-table" style={{ marginRight: 6 }} />Consolidado
            </button>
            {data.by_professional.map(p => (
              <button key={p.professional_id} onClick={() => setTab(String(p.professional_id))} style={{
                padding: '8px 18px', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
                borderBottom: String(tab) === String(p.professional_id) ? '2px solid #2E86C1' : '2px solid transparent',
                color: String(tab) === String(p.professional_id) ? '#2E86C1' : 'var(--gray-500)', background: 'none', marginBottom: -2
              }}>
                <i className="fas fa-user-doctor" style={{ marginRight: 6 }} />{p.professional_name}
              </button>
            ))}
          </div>

          <div className="card" style={{ borderRadius: '0 0 10px 10px', marginTop: 0 }}>
            {/* ── Aba Consolidado ── */}
            {tab === 'consolidated' && (
              <div className="table-container">
                <table className="table" style={{ fontSize: 13 }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'left' }}>Data</th>
                      <th style={{ textAlign: 'right' }}>Atend.</th>
                      <th style={{ textAlign: 'right' }}>Receita Bruta</th>
                      <th style={{ textAlign: 'right', color: '#e91e8c' }}>Estética</th>
                      <th style={{ textAlign: 'right' }}>Repasse</th>
                      <th style={{ textAlign: 'right' }}>Acertos +</th>
                      <th style={{ textAlign: 'right' }}>Acertos −</th>
                      <th style={{ textAlign: 'right' }}>Líquido do Dia</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.days.length === 0 && (
                      <tr><td colSpan={8}><div className="empty-state"><i className="fas fa-file-invoice" /><p>Nenhum movimento no período</p></div></td></tr>
                    )}
                    {data.days.map((row, i) => (
                      <tr key={row.day} style={{ background: i % 2 === 0 ? '#f8f9fa' : 'white' }}>
                        <td style={{ padding: '8px 12px', fontWeight: 500 }}>{dayjs(row.day).format('DD/MM/YYYY')}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'right' }}>{row.by_professional.reduce((s,p)=>s+p.count,0)}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', color: '#1a5276', fontWeight: 600 }}>{fmt(row.gross)}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', color: '#e91e8c', fontWeight: 600 }}>{row.aesthetics_gross > 0 ? fmt(row.aesthetics_gross) : '—'}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', color: '#7d3c98' }}>{fmt(row.repasse)}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', color: '#1e8449' }}>{row.settlements_in > 0 ? fmt(row.settlements_in) : '—'}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', color: '#c0392b' }}>{row.settlements_out > 0 ? fmt(row.settlements_out) : '—'}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: row.net >= 0 ? '#1e8449' : '#c0392b' }}>{fmt(row.net)}</td>
                      </tr>
                    ))}
                    {data.totals.rentals > 0 && (
                      <tr style={{ background: '#fffbeb' }}>
                        <td style={{ padding: '8px 12px', fontStyle: 'italic', color: '#e67e22' }} colSpan={7}>Aluguéis do mês</td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600, color: '#e67e22' }}>− {fmt(data.totals.rentals)}</td>
                      </tr>
                    )}
                    <tr style={{ background: '#1e8449' }}>
                      <td style={{ padding: '10px 12px', fontWeight: 800, color: 'white' }} colSpan={2}>TOTAL DO MÊS</td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: 'white' }}>{fmt(data.totals.gross)}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: 'white' }}>{fmt(data.totals.aesthetics_gross)}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: 'white' }}>{fmt(data.totals.repasse)}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: 'white' }}>{fmt(data.totals.settlements_in)}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: 'white' }}>{fmt(data.totals.settlements_out)}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 800, color: 'white' }}>{fmt(data.totals.net)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}

            {/* ── Aba por profissional ── */}
            {currentProf && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: '1px solid var(--gray-100)', background: '#f8f9fa' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>{currentProf.professional_name}</div>
                    <div style={{ fontSize: 12, color: 'var(--gray-500)' }}>Repasse: {currentProf.repasse_percent}% · {MONTHS[month-1]}/{year}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {emailResult && (
                      <span style={{ fontSize: 12, color: emailResult.ok ? '#1e8449' : '#c0392b', fontWeight: 600 }}>
                        {emailResult.ok ? '✓' : '✗'} {emailResult.msg}
                      </span>
                    )}
                    <button className="btn btn-outline btn-sm" onClick={() => handleSendEmail(currentProf)} disabled={emailLoading}>
                      <i className="fas fa-envelope" style={{ marginRight: 6 }} />{emailLoading ? 'Enviando...' : 'Enviar por e-mail'}
                    </button>
                  </div>
                </div>

                <div className="table-container">
                  <table className="table" style={{ fontSize: 13 }}>
                    <thead>
                      <tr>
                        <th style={{ textAlign: 'left' }}>Data</th>
                        <th style={{ textAlign: 'right' }}>Atend.</th>
                        <th style={{ textAlign: 'right' }}>Receita Bruta</th>
                        <th style={{ textAlign: 'right' }}>Repasse ({currentProf.repasse_percent}%)</th>
                        <th style={{ textAlign: 'right' }}>Acertos +</th>
                        <th style={{ textAlign: 'right' }}>Acertos −</th>
                        <th style={{ textAlign: 'right' }}>Líquido</th>
                      </tr>
                    </thead>
                    <tbody>
                      {currentProf.daily_rows.length === 0 && (
                        <tr><td colSpan={7}><div className="empty-state"><i className="fas fa-file" /><p>Sem movimento no período</p></div></td></tr>
                      )}
                      {currentProf.daily_rows.map((row, i) => (
                        <tr key={row.day} style={{ background: i % 2 === 0 ? '#f8f9fa' : 'white' }}>
                          <td style={{ padding: '8px 12px', fontWeight: 500 }}>{dayjs(row.day).format('DD/MM/YYYY')}</td>
                          <td style={{ padding: '8px 12px', textAlign: 'right' }}>{row.count}</td>
                          <td style={{ padding: '8px 12px', textAlign: 'right', color: '#1a5276', fontWeight: 600 }}>{fmt(row.gross)}</td>
                          <td style={{ padding: '8px 12px', textAlign: 'right', color: '#7d3c98' }}>{fmt(row.repasse)}</td>
                          <td style={{ padding: '8px 12px', textAlign: 'right', color: '#1e8449' }}>{row.settlements_in > 0 ? fmt(row.settlements_in) : '—'}</td>
                          <td style={{ padding: '8px 12px', textAlign: 'right', color: '#c0392b' }}>{row.settlements_out > 0 ? fmt(row.settlements_out) : '—'}</td>
                          <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: row.net >= 0 ? '#1e8449' : '#c0392b' }}>{fmt(row.net)}</td>
                        </tr>
                      ))}
                      <tr style={{ background: '#1e8449' }}>
                        <td style={{ padding: '10px 12px', fontWeight: 800, color: 'white' }} colSpan={2}>TOTAL</td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: 'white' }}>{fmt(currentProf.gross)}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: 'white' }}>{fmt(currentProf.repasse)}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: 'white' }}>{fmt(currentProf.settlements_in)}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: 'white' }}>{fmt(currentProf.settlements_out)}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 800, color: 'white' }}>{fmt(currentProf.net)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {!data && !loading && (
        <div className="card">
          <div className="empty-state">
            <i className="fas fa-file-invoice-dollar" />
            <p>Selecione o mês e clique em <strong>Gerar Extrato</strong></p>
          </div>
        </div>
      )}
    </div>
  );
}
