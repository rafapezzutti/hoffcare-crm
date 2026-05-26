import { useState, useEffect, useRef } from 'react';
import api from '../services/api';
import dayjs from 'dayjs';

const MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
                'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

const fmt = (v) => parseFloat(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 });

function buildEmailHtml(data) {
  const { professional, year, month, records, settlements, rentals, summary } = data;
  const monthName = MONTHS[month - 1];

  const recordsRows = records.map(r => `
    <tr>
      <td style="padding:8px;border-bottom:1px solid #eee;">${new Date(r.consultation_date).toLocaleDateString('pt-BR',{timeZone:'UTC'})}</td>
      <td style="padding:8px;border-bottom:1px solid #eee;">${r.patient_name || '—'}</td>
      <td style="padding:8px;border-bottom:1px solid #eee;">${(r.procedures || []).join(', ') || '—'}</td>
      <td style="padding:8px;border-bottom:1px solid #eee;text-align:right;color:#28a745;font-weight:700;">R$ ${fmt(r.total_value)}</td>
    </tr>
  `).join('');

  const settlementsRows = settlements.map(s => `
    <tr>
      <td style="padding:8px;border-bottom:1px solid #eee;">${new Date(s.date).toLocaleDateString('pt-BR',{timeZone:'UTC'})}</td>
      <td style="padding:8px;border-bottom:1px solid #eee;">${s.description || '—'}</td>
      <td style="padding:8px;border-bottom:1px solid #eee;">
        <span style="color:${s.type==='a_pagar'?'#dc3545':'#28a745'}">${s.type==='a_pagar'?'Clínica paga':'Profissional paga'}</span>
      </td>
      <td style="padding:8px;border-bottom:1px solid #eee;text-align:right;font-weight:700;color:${s.type==='a_pagar'?'#28a745':'#dc3545'};">
        ${s.type==='a_pagar'?'+':'−'} R$ ${fmt(s.value)}
      </td>
    </tr>
  `).join('');

  const rentalsRows = rentals.map(r => `
    <tr>
      <td style="padding:8px;border-bottom:1px solid #eee;">${r.space_description || r.room_name || 'Espaço'}</td>
      <td style="padding:8px;border-bottom:1px solid #eee;">${r.recurrence}</td>
      <td style="padding:8px;border-bottom:1px solid #eee;text-align:right;color:#dc3545;font-weight:700;">− R$ ${fmt(r.value)}</td>
    </tr>
  `).join('');

  return `
    <div style="font-family:Arial,sans-serif;max-width:650px;margin:0 auto;color:#333;">
      <div style="background:#1a2535;padding:24px;border-radius:8px 8px 0 0;text-align:center;">
        <div style="font-size:22px;font-weight:800;color:#4DB8E8;">P. Soluções</div>
        <div style="font-size:13px;font-weight:600;color:#E8841A;">para Saúde</div>
        <div style="margin-top:12px;font-size:16px;color:#fff;font-weight:700;">
          Extrato Financeiro — ${monthName}/${year}
        </div>
      </div>
      <div style="background:#fff;border:1px solid #e9ecef;border-top:none;padding:32px;border-radius:0 0 8px 8px;">
        <h2 style="margin:0 0 4px;font-size:16px;color:#1a2535;">${professional.name}</h2>
        <p style="margin:0 0 24px;color:#6c757d;font-size:13px;">${professional.clinic_name || ''}</p>

        <!-- Resumo -->
        <div style="background:#f8f9fa;border-radius:8px;padding:20px;margin-bottom:24px;display:flex;gap:16px;flex-wrap:wrap;">
          <div style="flex:1;min-width:120px;text-align:center;">
            <div style="font-size:11px;color:#6c757d;text-transform:uppercase;letter-spacing:1px;">Atendimentos</div>
            <div style="font-size:20px;font-weight:700;color:#28a745;">R$ ${fmt(summary.total_records)}</div>
          </div>
          ${rentals.length > 0 ? `<div style="flex:1;min-width:120px;text-align:center;">
            <div style="font-size:11px;color:#6c757d;text-transform:uppercase;letter-spacing:1px;">Aluguéis</div>
            <div style="font-size:20px;font-weight:700;color:#dc3545;">− R$ ${fmt(summary.total_rentals)}</div>
          </div>` : ''}
          ${settlements.length > 0 ? `<div style="flex:1;min-width:120px;text-align:center;">
            <div style="font-size:11px;color:#6c757d;text-transform:uppercase;letter-spacing:1px;">Acertos</div>
            <div style="font-size:20px;font-weight:700;color:${summary.total_settlements_in - summary.total_settlements_out >= 0 ? '#28a745' : '#dc3545'};">
              R$ ${fmt(summary.total_settlements_in - summary.total_settlements_out)}
            </div>
          </div>` : ''}
          <div style="flex:1;min-width:120px;text-align:center;border-left:2px solid #dee2e6;padding-left:16px;">
            <div style="font-size:11px;color:#6c757d;text-transform:uppercase;letter-spacing:1px;">Líquido</div>
            <div style="font-size:22px;font-weight:800;color:${summary.net_total >= 0 ? '#1a2535' : '#dc3545'};">
              R$ ${fmt(summary.net_total)}
            </div>
          </div>
        </div>

        <!-- Atendimentos -->
        ${records.length > 0 ? `
        <h3 style="font-size:14px;font-weight:700;color:#1a2535;margin:0 0 12px;border-bottom:2px solid #4DB8E8;padding-bottom:6px;">
          📋 Atendimentos (${records.length})
        </h3>
        <table style="width:100%;border-collapse:collapse;margin-bottom:24px;font-size:13px;">
          <thead><tr style="background:#f8f9fa;">
            <th style="padding:8px;text-align:left;color:#6c757d;font-weight:600;">Data</th>
            <th style="padding:8px;text-align:left;color:#6c757d;font-weight:600;">Paciente</th>
            <th style="padding:8px;text-align:left;color:#6c757d;font-weight:600;">Procedimentos</th>
            <th style="padding:8px;text-align:right;color:#6c757d;font-weight:600;">Valor</th>
          </tr></thead>
          <tbody>${recordsRows}</tbody>
          <tfoot><tr style="background:#e8f5e9;">
            <td colspan="3" style="padding:10px;font-weight:700;">Total Atendimentos</td>
            <td style="padding:10px;text-align:right;font-weight:800;color:#28a745;">R$ ${fmt(summary.total_records)}</td>
          </tr></tfoot>
        </table>` : ''}

        <!-- Aluguéis -->
        ${rentals.length > 0 ? `
        <h3 style="font-size:14px;font-weight:700;color:#1a2535;margin:0 0 12px;border-bottom:2px solid #E8841A;padding-bottom:6px;">
          🔑 Descontos de Locação
        </h3>
        <table style="width:100%;border-collapse:collapse;margin-bottom:24px;font-size:13px;">
          <thead><tr style="background:#f8f9fa;">
            <th style="padding:8px;text-align:left;color:#6c757d;">Espaço</th>
            <th style="padding:8px;text-align:left;color:#6c757d;">Recorrência</th>
            <th style="padding:8px;text-align:right;color:#6c757d;">Valor</th>
          </tr></thead>
          <tbody>${rentalsRows}</tbody>
          <tfoot><tr style="background:#fdecea;">
            <td colspan="2" style="padding:10px;font-weight:700;">Total Aluguéis</td>
            <td style="padding:10px;text-align:right;font-weight:800;color:#dc3545;">− R$ ${fmt(summary.total_rentals)}</td>
          </tr></tfoot>
        </table>` : ''}

        <!-- Acertos -->
        ${settlements.length > 0 ? `
        <h3 style="font-size:14px;font-weight:700;color:#1a2535;margin:0 0 12px;border-bottom:2px solid #6f42c1;padding-bottom:6px;">
          🤝 Acertos Financeiros
        </h3>
        <table style="width:100%;border-collapse:collapse;margin-bottom:24px;font-size:13px;">
          <thead><tr style="background:#f8f9fa;">
            <th style="padding:8px;text-align:left;color:#6c757d;">Data</th>
            <th style="padding:8px;text-align:left;color:#6c757d;">Descrição</th>
            <th style="padding:8px;text-align:left;color:#6c757d;">Tipo</th>
            <th style="padding:8px;text-align:right;color:#6c757d;">Valor</th>
          </tr></thead>
          <tbody>${settlementsRows}</tbody>
        </table>` : ''}

        <!-- Total líquido -->
        <div style="background:#1a2535;border-radius:8px;padding:20px;text-align:center;margin-top:8px;">
          <div style="font-size:12px;color:#adb5bd;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">
            Total Líquido — ${monthName}/${year}
          </div>
          <div style="font-size:32px;font-weight:800;color:${summary.net_total >= 0 ? '#4DB8E8' : '#dc3545'};">
            R$ ${fmt(summary.net_total)}
          </div>
        </div>

        <hr style="border:none;border-top:1px solid #e9ecef;margin:24px 0;" />
        <p style="color:#adb5bd;font-size:11px;text-align:center;margin:0;">
          P. Soluções para Saúde · Sistema de Gestão Clínica · Extrato gerado em ${new Date().toLocaleDateString('pt-BR')}
        </p>
      </div>
    </div>
  `;
}

export default function ProfessionalStatement() {
  const now = dayjs();
  const [professionals, setProfessionals] = useState([]);
  const [selProfId, setSelProfId] = useState('');
  const [selYear, setSelYear] = useState(now.year());
  const [selMonth, setSelMonth] = useState(now.month() + 1);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState('');
  const printRef = useRef();

  useEffect(() => {
    api.get('/professionals').then(r => setProfessionals(r.data)).catch(() => {});
  }, []);

  const loadStatement = async () => {
    if (!selProfId) return;
    setLoading(true); setMsg(''); setData(null);
    try {
      const r = await api.get(`/settlements/statement/${selProfId}?year=${selYear}&month=${selMonth}`);
      setData(r.data);
    } catch (err) {
      setMsg('Erro ao carregar extrato.');
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    if (!data) return;
    const w = window.open('', '_blank');
    w.document.write(`<html><head><title>Extrato</title>
      <style>body{margin:0;padding:20px;font-family:Arial,sans-serif;}@media print{body{margin:0;}}</style>
    </head><body>${buildEmailHtml(data)}</body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => { w.print(); }, 500);
  };

  const handleSendEmail = async () => {
    if (!data) return;
    if (!data.professional?.email) {
      setMsg('❌ Profissional não tem email cadastrado.');
      return;
    }
    if (!confirm(`Enviar extrato para ${data.professional.email}?`)) return;
    setSending(true); setMsg('');
    try {
      await api.post(`/settlements/statement/${selProfId}/send-email`, {
        html: buildEmailHtml(data),
        year: selYear,
        month: selMonth,
        professional_name: data.professional.name,
        professional_email: data.professional.email,
      });
      setMsg('✅ Email enviado com sucesso!');
    } catch (err) {
      setMsg('❌ ' + (err.response?.data?.error || 'Erro ao enviar email'));
    } finally {
      setSending(false);
    }
  };

  const years = [];
  for (let y = now.year(); y >= now.year() - 3; y--) years.push(y);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">
            <i className="fas fa-file-invoice-dollar" style={{ marginRight: 10, color: 'var(--blue)' }} />
            Extrato Mensal por Profissional
          </h1>
          <p className="page-subtitle">Resumo financeiro com atendimentos, aluguéis e acertos</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div className="form-group" style={{ flex: 2, minWidth: 200, marginBottom: 0 }}>
            <label className="form-label">Profissional</label>
            <select className="form-control" value={selProfId} onChange={e => setSelProfId(e.target.value)}>
              <option value="">Selecione um profissional...</option>
              {professionals.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div className="form-group" style={{ width: 150, marginBottom: 0 }}>
            <label className="form-label">Mês</label>
            <select className="form-control" value={selMonth} onChange={e => setSelMonth(Number(e.target.value))}>
              {MONTHS.map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
            </select>
          </div>
          <div className="form-group" style={{ width: 100, marginBottom: 0 }}>
            <label className="form-label">Ano</label>
            <select className="form-control" value={selYear} onChange={e => setSelYear(Number(e.target.value))}>
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <button className="btn btn-primary" onClick={loadStatement} disabled={!selProfId || loading}>
            {loading ? <><i className="fas fa-spinner fa-spin" /> Carregando...</> : <><i className="fas fa-search" /> Gerar Extrato</>}
          </button>
        </div>
      </div>

      {msg && (
        <div className={`alert ${msg.startsWith('✅') ? 'alert-success' : 'alert-error'}`} style={{ marginBottom: 16 }}>
          {msg}
        </div>
      )}

      {data && (() => {
        const isEmpty = data.records.length === 0 && data.rentals.length === 0 && data.settlements.length === 0;
        if (isEmpty) return (
          <div className="card">
            <div className="empty-state" style={{ padding: 60 }}>
              <i className="fas fa-calendar-times" style={{ fontSize: 48, color: 'var(--gray-300)' }} />
              <p style={{ marginTop: 16, fontSize: 16, fontWeight: 600, color: 'var(--gray-600)' }}>
                Nenhum registro encontrado
              </p>
              <p style={{ fontSize: 13, color: 'var(--gray-400)', marginTop: 4 }}>
                {data.professional?.name} não possui atendimentos, locações ou acertos em{' '}
                <strong>{MONTHS[selMonth - 1]}/{selYear}</strong>.
              </p>
            </div>
          </div>
        );
        return (
        <>
          {/* Botões de ação */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 16, justifyContent: 'flex-end' }}>
            <button className="btn btn-outline" onClick={handlePrint}>
              <i className="fas fa-print" /> Imprimir / Salvar PDF
            </button>
            <button className="btn btn-primary" onClick={handleSendEmail} disabled={sending}>
              {sending
                ? <><i className="fas fa-spinner fa-spin" /> Enviando...</>
                : <><i className="fas fa-envelope" /> Enviar por Email</>}
            </button>
          </div>

          {/* Preview do extrato */}
          <div className="card" ref={printRef}>
            {/* Cabeçalho */}
            <div style={{ background: '#1a2535', borderRadius: 8, padding: 24, marginBottom: 24, textAlign: 'center' }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#4DB8E8' }}>P. Soluções para Saúde</div>
              <div style={{ fontSize: 14, color: '#E8841A', marginBottom: 8 }}>Extrato Financeiro</div>
              <div style={{ fontSize: 18, color: '#fff', fontWeight: 700 }}>
                {MONTHS[selMonth - 1]}/{selYear}
              </div>
            </div>

            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--gray-800)' }}>{data.professional.name}</div>
              <div style={{ fontSize: 13, color: 'var(--gray-500)' }}>{data.professional.clinic_name}</div>
              {data.professional.email && (
                <div style={{ fontSize: 13, color: 'var(--gray-500)' }}>{data.professional.email}</div>
              )}
            </div>

            {/* Cards de resumo */}
            <div className="stats-grid" style={{ marginBottom: 24 }}>
              <div className="stat-card">
                <div className="stat-icon green"><i className="fas fa-stethoscope" /></div>
                <div>
                  <div className="stat-value" style={{ fontSize: 20, color: 'var(--success)' }}>
                    R$ {fmt(data.summary.total_records)}
                  </div>
                  <div className="stat-label">
                    {data.records.length} atendimento(s)
                    {data.summary.repasse_percent < 100 && (
                      <span style={{ marginLeft: 6, background: 'rgba(77,184,232,0.15)', color: '#1a7fad', borderRadius: 4, padding: '1px 6px', fontSize: 11, fontWeight: 600 }}>
                        {data.summary.repasse_percent}% repasse
                      </span>
                    )}
                  </div>
                  {data.summary.repasse_percent < 100 && (
                    <div style={{ fontSize: 11, color: 'var(--gray-400)', marginTop: 2 }}>
                      Bruto R$ {fmt(data.summary.total_records_gross)}
                    </div>
                  )}
                </div>
              </div>
              {data.rentals.length > 0 && (
                <div className="stat-card">
                  <div className="stat-icon orange"><i className="fas fa-key" /></div>
                  <div>
                    <div className="stat-value" style={{ fontSize: 20, color: '#dc3545' }}>
                      − R$ {fmt(data.summary.total_rentals)}
                    </div>
                    <div className="stat-label">{data.rentals.length} locação(ões)</div>
                  </div>
                </div>
              )}
              {data.settlements.length > 0 && (
                <div className="stat-card">
                  <div className="stat-icon blue"><i className="fas fa-handshake" /></div>
                  <div>
                    <div className="stat-value" style={{ fontSize: 20,
                      color: data.summary.total_settlements_in - data.summary.total_settlements_out >= 0 ? 'var(--success)' : '#dc3545'
                    }}>
                      R$ {fmt(data.summary.total_settlements_in - data.summary.total_settlements_out)}
                    </div>
                    <div className="stat-label">{data.settlements.length} acerto(s)</div>
                  </div>
                </div>
              )}
              <div className="stat-card" style={{ background: 'var(--gray-800)', color: '#fff' }}>
                <div className="stat-icon" style={{ background: '#4DB8E820' }}>
                  <i className="fas fa-dollar-sign" style={{ color: '#4DB8E8' }} />
                </div>
                <div>
                  <div className="stat-value" style={{
                    fontSize: 22,
                    color: data.summary.net_total >= 0 ? '#4DB8E8' : '#dc3545'
                  }}>
                    R$ {fmt(data.summary.net_total)}
                  </div>
                  <div className="stat-label" style={{ color: '#adb5bd' }}>Total líquido</div>
                </div>
              </div>
            </div>

            {/* Tabela de atendimentos */}
            {data.records.length > 0 && (
              <>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--gray-700)', marginBottom: 10, borderBottom: '2px solid var(--blue)', paddingBottom: 6 }}>
                  <i className="fas fa-clipboard-list" style={{ marginRight: 8, color: 'var(--blue)' }} />
                  Atendimentos
                </div>
                <div className="table-container" style={{ marginBottom: 24 }}>
                  <table className="table">
                    <thead>
                      <tr><th>Data</th><th>Paciente</th><th>Procedimentos</th><th style={{ textAlign: 'right' }}>Valor</th></tr>
                    </thead>
                    <tbody>
                      {data.records.map((r, i) => (
                        <tr key={i}>
                          <td>{new Date(r.consultation_date).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}</td>
                          <td>{r.patient_name}</td>
                          <td style={{ fontSize: 12, color: 'var(--gray-500)' }}>{(r.procedures || []).join(', ') || '—'}</td>
                          <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--success)' }}>
                            R$ {fmt(r.total_value)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr style={{ background: 'var(--gray-50)' }}>
                        <td colSpan={3} style={{ fontWeight: 700 }}>Total Atendimentos</td>
                        <td style={{ textAlign: 'right', fontWeight: 800, color: 'var(--success)' }}>
                          R$ {fmt(data.summary.total_records)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </>
            )}

            {/* Tabela de locações */}
            {data.rentals.length > 0 && (
              <>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--gray-700)', marginBottom: 10, borderBottom: '2px solid var(--orange)', paddingBottom: 6 }}>
                  <i className="fas fa-key" style={{ marginRight: 8, color: 'var(--orange)' }} />
                  Descontos de Locação
                </div>
                <div className="table-container" style={{ marginBottom: 24 }}>
                  <table className="table">
                    <thead>
                      <tr><th>Espaço</th><th>Recorrência</th><th style={{ textAlign: 'right' }}>Valor</th></tr>
                    </thead>
                    <tbody>
                      {data.rentals.map((r, i) => (
                        <tr key={i}>
                          <td>{r.space_description || r.room_name || 'Espaço'}</td>
                          <td>{r.recurrence}</td>
                          <td style={{ textAlign: 'right', fontWeight: 700, color: '#dc3545' }}>
                            − R$ {fmt(r.value)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr style={{ background: '#fff5f5' }}>
                        <td colSpan={2} style={{ fontWeight: 700 }}>Total Locações</td>
                        <td style={{ textAlign: 'right', fontWeight: 800, color: '#dc3545' }}>
                          − R$ {fmt(data.summary.total_rentals)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </>
            )}

            {/* Tabela de acertos */}
            {data.settlements.length > 0 && (
              <>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--gray-700)', marginBottom: 10, borderBottom: '2px solid #6f42c1', paddingBottom: 6 }}>
                  <i className="fas fa-handshake" style={{ marginRight: 8, color: '#6f42c1' }} />
                  Acertos Financeiros
                </div>
                <div className="table-container" style={{ marginBottom: 24 }}>
                  <table className="table">
                    <thead>
                      <tr><th>Data</th><th>Descrição</th><th>Tipo</th><th style={{ textAlign: 'right' }}>Valor</th></tr>
                    </thead>
                    <tbody>
                      {data.settlements.map((s, i) => (
                        <tr key={i}>
                          <td>{new Date(s.date).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}</td>
                          <td>{s.description || '—'}</td>
                          <td>
                            <span style={{
                              fontSize: 12, fontWeight: 600,
                              color: s.type === 'a_pagar' ? '#28a745' : '#dc3545',
                            }}>
                              {s.type === 'a_pagar' ? '↑ Clínica paga' : '↓ Prof. paga'}
                            </span>
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 700, color: s.type === 'a_pagar' ? '#28a745' : '#dc3545' }}>
                            {s.type === 'a_pagar' ? '+' : '−'} R$ {fmt(s.value)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {/* Total líquido final */}
            <div style={{
              background: '#1a2535', borderRadius: 8, padding: 24, textAlign: 'center',
            }}>
              <div style={{ fontSize: 12, color: '#adb5bd', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
                Total Líquido — {MONTHS[selMonth - 1]}/{selYear}
              </div>
              <div style={{
                fontSize: 36, fontWeight: 800,
                color: data.summary.net_total >= 0 ? '#4DB8E8' : '#dc3545'
              }}>
                R$ {fmt(data.summary.net_total)}
              </div>
              <div style={{ fontSize: 12, color: '#6c757d', marginTop: 8 }}>
                Procedimentos R$ {fmt(data.summary.total_records)}
                {data.summary.repasse_percent < 100 && ` (${data.summary.repasse_percent}% de R$ ${fmt(data.summary.total_records_gross)})`}
                {data.rentals.length > 0 && ` − Locações R$ ${fmt(data.summary.total_rentals)}`}
                {data.settlements.length > 0 && ` ± Acertos R$ ${fmt(Math.abs(data.summary.total_settlements_in - data.summary.total_settlements_out))}`}
              </div>
            </div>
          </div>
        </>
        );
      })()}

      {!data && !loading && (
        <div className="card">
          <div className="empty-state" style={{ padding: 60 }}>
            <i className="fas fa-file-invoice-dollar" style={{ fontSize: 48 }} />
            <p>Selecione um profissional e clique em "Gerar Extrato"</p>
          </div>
        </div>
      )}
    </div>
  );
}
