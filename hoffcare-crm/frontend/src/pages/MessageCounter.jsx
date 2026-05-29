import { useState, useEffect } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

const MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

const ChIcon = ({ channel }) => channel === 'whatsapp'
  ? <i className="fab fa-whatsapp" style={{ color: '#25D366', marginRight: 6 }} />
  : <i className="fas fa-envelope" style={{ color: '#4DB8E8', marginRight: 6 }} />;

export default function MessageCounter() {
  const { user } = useAuth();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const isAdmin = user?.role === 'admin';

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/message-log?year=${year}&month=${month}`);
      setData(res.data);
    } catch (err) { alert(err.response?.data?.error || 'Erro ao carregar'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [year, month]);

  const emailTotal = data?.totals?.find(t => t.channel === 'email')?.total || 0;
  const wppTotal   = data?.totals?.find(t => t.channel === 'whatsapp')?.total || 0;
  const emailRows  = data?.summary?.filter(s => s.channel === 'email') || [];
  const wppRows    = data?.summary?.filter(s => s.channel === 'whatsapp') || [];

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title"><i className="fas fa-chart-bar" style={{ marginRight: 8, color: 'var(--blue)' }} />Contador de Mensagens</h1>
          <p className="page-subtitle">Volume de e-mails e WhatsApp enviados por tipo e canal</p>
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
              {[2024,2025,2026,2027].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <button className="btn btn-outline" onClick={load} disabled={loading}>
            <i className="fas fa-sync" style={{ marginRight: 6 }} />{loading ? 'Carregando...' : 'Atualizar'}
          </button>
        </div>
      </div>

      {/* Cards totais */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        {[
          { label: 'E-mails enviados', value: emailTotal, icon: 'fa-envelope', color: '#4DB8E8' },
          { label: 'WhatsApp enviados', value: wppTotal,  icon: 'fab fa-whatsapp', color: '#25D366' },
          { label: 'Total do mês', value: Number(emailTotal) + Number(wppTotal), icon: 'fa-paper-plane', color: '#7d3c98' },
        ].map(c => (
          <div key={c.label} style={{ background: 'white', border: '1px solid var(--gray-200)', borderRadius: 10, padding: '16px 20px', flex: 1, minWidth: 160 }}>
            <div style={{ fontSize: 11, color: 'var(--gray-400)', textTransform: 'uppercase', fontWeight: 600, letterSpacing: 0.5 }}>{c.label}</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: c.color, marginTop: 6 }}>{c.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* E-mail */}
        <div className="card" style={{ padding: 0 }}>
          <div style={{ padding: '12px 16px', fontWeight: 700, fontSize: 13, borderBottom: '1px solid var(--gray-100)', display: 'flex', alignItems: 'center' }}>
            <ChIcon channel="email" />E-mail por tipo
          </div>
          {emailRows.length === 0 ? <div style={{ padding: 24, textAlign: 'center', color: 'var(--gray-400)', fontSize: 13 }}>Nenhum e-mail enviado</div> : (
            <table className="table" style={{ fontSize: 13 }}>
              <thead><tr><th>Tipo</th><th style={{ textAlign: 'right' }}>Total</th></tr></thead>
              <tbody>
                {emailRows.map((r, i) => (
                  <tr key={r.type} style={{ background: i%2===0?'#f8f9fa':'white' }}>
                    <td style={{ padding: '8px 16px' }}>{r.type_label || r.type}</td>
                    <td style={{ padding: '8px 16px', textAlign: 'right', fontWeight: 700, color: '#4DB8E8' }}>{r.total}</td>
                  </tr>
                ))}
                <tr style={{ background: '#EBF5FB' }}>
                  <td style={{ padding: '8px 16px', fontWeight: 700 }}>Total</td>
                  <td style={{ padding: '8px 16px', textAlign: 'right', fontWeight: 800, color: '#1a5276' }}>{emailTotal}</td>
                </tr>
              </tbody>
            </table>
          )}
        </div>

        {/* WhatsApp */}
        <div className="card" style={{ padding: 0 }}>
          <div style={{ padding: '12px 16px', fontWeight: 700, fontSize: 13, borderBottom: '1px solid var(--gray-100)', display: 'flex', alignItems: 'center' }}>
            <ChIcon channel="whatsapp" />WhatsApp por tipo
          </div>
          {wppRows.length === 0 ? <div style={{ padding: 24, textAlign: 'center', color: 'var(--gray-400)', fontSize: 13 }}>Nenhuma mensagem enviada</div> : (
            <table className="table" style={{ fontSize: 13 }}>
              <thead><tr><th>Tipo</th><th style={{ textAlign: 'right' }}>Total</th></tr></thead>
              <tbody>
                {wppRows.map((r, i) => (
                  <tr key={r.type} style={{ background: i%2===0?'#f8f9fa':'white' }}>
                    <td style={{ padding: '8px 16px' }}>{r.type_label || r.type}</td>
                    <td style={{ padding: '8px 16px', textAlign: 'right', fontWeight: 700, color: '#25D366' }}>{r.total}</td>
                  </tr>
                ))}
                <tr style={{ background: '#f0fdf4' }}>
                  <td style={{ padding: '8px 16px', fontWeight: 700 }}>Total</td>
                  <td style={{ padding: '8px 16px', textAlign: 'right', fontWeight: 800, color: '#1e8449' }}>{wppTotal}</td>
                </tr>
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Por clínica (apenas admin) */}
      {isAdmin && data?.by_clinic?.length > 0 && (
        <div className="card" style={{ marginTop: 16, padding: 0 }}>
          <div style={{ padding: '12px 16px', fontWeight: 700, fontSize: 13, borderBottom: '1px solid var(--gray-100)' }}>
            <i className="fas fa-hospital" style={{ marginRight: 6, color: 'var(--blue)' }} />Por clínica
          </div>
          <table className="table" style={{ fontSize: 13 }}>
            <thead><tr><th>Clínica</th><th style={{ textAlign: 'center' }}>Canal</th><th style={{ textAlign: 'right' }}>Total</th></tr></thead>
            <tbody>
              {data.by_clinic.map((r, i) => (
                <tr key={`${r.clinic_id}_${r.channel}`} style={{ background: i%2===0?'#f8f9fa':'white' }}>
                  <td style={{ padding: '8px 16px' }}>{r.clinic_name || `Clínica #${r.clinic_id}`}</td>
                  <td style={{ padding: '8px 16px', textAlign: 'center' }}><ChIcon channel={r.channel} />{r.channel}</td>
                  <td style={{ padding: '8px 16px', textAlign: 'right', fontWeight: 700 }}>{r.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
