import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';

const MONTHS = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

const SOURCE_META = {
  'Atendimentos': { icon: 'fa-stethoscope',      color: '#3b82f6' },
  'Aluguéis':     { icon: 'fa-key',               color: '#8b5cf6' },
  'Acertos':      { icon: 'fa-handshake',          color: '#0ea5e9' },
  'Despesas':     { icon: 'fa-file-invoice-dollar',color: '#ef4444' },
};

function nowMonthRange() {
  const n = new Date();
  return {
    start: `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-01`,
    end:   new Date(n.getFullYear(), n.getMonth() + 1, 0).toISOString().slice(0, 10),
  };
}

const PRESETS = [
  {
    label: 'Este mês',
    get: () => nowMonthRange(),
  },
  {
    label: 'Mês anterior',
    get: () => {
      const n  = new Date();
      const m  = n.getMonth() === 0 ? 12 : n.getMonth();
      const y  = n.getMonth() === 0 ? n.getFullYear() - 1 : n.getFullYear();
      return { start: `${y}-${String(m).padStart(2, '0')}-01`, end: new Date(y, m, 0).toISOString().slice(0, 10) };
    },
  },
  {
    label: 'Últimos 3 meses',
    get: () => {
      const n = new Date();
      const s = new Date(n.getFullYear(), n.getMonth() - 2, 1);
      return { start: s.toISOString().slice(0, 10), end: new Date(n.getFullYear(), n.getMonth() + 1, 0).toISOString().slice(0, 10) };
    },
  },
  {
    label: 'Este ano',
    get: () => {
      const y = new Date().getFullYear();
      return { start: `${y}-01-01`, end: `${y}-12-31` };
    },
  },
];

function fmt(val) {
  return Number(val || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function fmtDate(d) {
  if (!d) return '—';
  return new Date(String(d).slice(0, 10) + 'T12:00:00').toLocaleDateString('pt-BR');
}

export default function CashFlow() {
  const now           = new Date();
  const [period,      setPeriod]      = useState(nowMonthRange);
  const [activePreset,setActivePreset]= useState(0);
  const [data,        setData]        = useState(null);
  const [monthly,     setMonthly]     = useState([]);
  const [loading,     setLoading]     = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [summaryRes, monthlyRes] = await Promise.all([
        api.get('/cash-flow', { params: { start: period.start, end: period.end } }),
        api.get('/cash-flow/monthly', { params: { year: now.getFullYear() } }),
      ]);
      setData(summaryRes.data);
      setMonthly(monthlyRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [period.start, period.end]);

  useEffect(() => { load(); }, [load]);

  const applyPreset = (idx) => {
    setActivePreset(idx);
    setPeriod(PRESETS[idx].get());
  };

  const maxBar   = Math.max(...monthly.map(m => Math.max(m.entradas, m.saidas)), 1);
  const saldoPos = (data?.saldo || 0) >= 0;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Fluxo de Caixa</h1>
          <p className="page-subtitle">Entradas e saídas realizadas no período</p>
        </div>
      </div>

      {/* Seletor de período */}
      <div className="card" style={{ marginBottom: 20, padding: '14px 20px' }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 6 }}>
            {PRESETS.map((p, i) => (
              <button key={i} onClick={() => applyPreset(i)}
                className={activePreset === i ? 'btn btn-primary btn-sm' : 'btn btn-outline btn-sm'}>
                {p.label}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 4 }}>
            <input type="date" className="form-control" style={{ width: 140 }} value={period.start}
              onChange={e => { setPeriod(p => ({ ...p, start: e.target.value })); setActivePreset(-1); }} />
            <span style={{ color: 'var(--gray-400)', fontSize: 12 }}>até</span>
            <input type="date" className="form-control" style={{ width: 140 }} value={period.end}
              onChange={e => { setPeriod(p => ({ ...p, end: e.target.value })); setActivePreset(-1); }} />
            <button className="btn btn-outline btn-sm" onClick={load}>
              <i className="fas fa-rotate-right" />
            </button>
          </div>
        </div>
      </div>

      {/* Cards de resumo */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
        <div className="card" style={{ padding: '20px 24px' }}>
          <div style={{ fontSize: 11, color: 'var(--gray-500)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
            <i className="fas fa-arrow-trend-up" style={{ color: '#22c55e', marginRight: 6 }} />
            Total Entradas
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, color: '#22c55e', lineHeight: 1 }}>
            {fmt(data?.totalEntradas)}
          </div>
        </div>
        <div className="card" style={{ padding: '20px 24px' }}>
          <div style={{ fontSize: 11, color: 'var(--gray-500)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
            <i className="fas fa-arrow-trend-down" style={{ color: '#ef4444', marginRight: 6 }} />
            Total Saídas
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, color: '#ef4444', lineHeight: 1 }}>
            {fmt(data?.totalSaidas)}
          </div>
        </div>
        <div className="card" style={{ padding: '20px 24px', background: saldoPos ? '#f0fdf4' : '#fef2f2', border: `1px solid ${saldoPos ? '#86efac' : '#fca5a5'}` }}>
          <div style={{ fontSize: 11, color: 'var(--gray-500)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
            <i className={`fas ${saldoPos ? 'fa-circle-check' : 'fa-circle-exclamation'}`}
              style={{ color: saldoPos ? '#22c55e' : '#ef4444', marginRight: 6 }} />
            Saldo Líquido
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, color: saldoPos ? '#16a34a' : '#dc2626', lineHeight: 1 }}>
            {saldoPos ? '+' : ''}{fmt(data?.saldo)}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: 20, marginBottom: 20 }}>

        {/* Gráfico anual */}
        <div className="card">
          <div style={{ padding: '16px 20px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--gray-100)' }}>
            <span style={{ fontWeight: 600, fontSize: 14 }}>Visão Anual {now.getFullYear()}</span>
            <div style={{ display: 'flex', gap: 12 }}>
              <span style={{ fontSize: 11, color: 'var(--gray-500)', display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ display:'inline-block', width:10, height:10, background:'#22c55e', borderRadius:2 }}/> Entradas
              </span>
              <span style={{ fontSize: 11, color: 'var(--gray-500)', display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ display:'inline-block', width:10, height:10, background:'#ef4444', borderRadius:2 }}/> Saídas
              </span>
            </div>
          </div>
          <div style={{ padding: '16px 20px 12px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 110 }}>
              {monthly.map(m => (
                <div key={m.month} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                  <div style={{ width: '100%', display: 'flex', gap: 2, alignItems: 'flex-end', height: 94 }}>
                    <div title={`Entradas: ${fmt(m.entradas)}`}
                      style={{ flex: 1, background: '#22c55e', borderRadius: '2px 2px 0 0', opacity: 0.75,
                        height: `${(m.entradas / maxBar) * 100}%`, minHeight: m.entradas > 0 ? 2 : 0, transition: 'height 0.3s' }} />
                    <div title={`Saídas: ${fmt(m.saidas)}`}
                      style={{ flex: 1, background: '#ef4444', borderRadius: '2px 2px 0 0', opacity: 0.75,
                        height: `${(m.saidas / maxBar) * 100}%`, minHeight: m.saidas > 0 ? 2 : 0, transition: 'height 0.3s' }} />
                  </div>
                  <span style={{ fontSize: 9, color: 'var(--gray-400)' }}>{MONTHS[m.month - 1]}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Por origem */}
        <div className="card">
          <div style={{ padding: '16px 20px 12px', borderBottom: '1px solid var(--gray-100)' }}>
            <span style={{ fontWeight: 600, fontSize: 14 }}>Por Origem</span>
          </div>
          <div style={{ padding: '12px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {data && Object.entries(data.bySource).map(([source, vals]) => {
              const sm     = SOURCE_META[source] || { icon: 'fa-tag', color: '#94a3b8' };
              const isIncome = vals.entradas >= vals.saidas;
              const main   = isIncome ? vals.entradas : vals.saidas;
              const sign   = isIncome ? '+' : '−';
              const clr    = isIncome ? '#22c55e' : '#ef4444';
              return (
                <div key={source} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 30, height: 30, borderRadius: 7, background: sm.color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <i className={`fas ${sm.icon}`} style={{ color: sm.color, fontSize: 12 }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 13, fontWeight: 500 }}>{source}</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: clr }}>{sign}{fmt(main)}</span>
                    </div>
                    {vals.entradas > 0 && vals.saidas > 0 && (
                      <div style={{ fontSize: 10, color: 'var(--gray-400)', marginTop: 1 }}>
                        E: {fmt(vals.entradas)} / S: {fmt(vals.saidas)}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            {data && Object.keys(data.bySource).length === 0 && (
              <div style={{ textAlign: 'center', color: 'var(--gray-400)', fontSize: 13, padding: '16px 0' }}>
                Nenhum lançamento
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tabela de lançamentos */}
      <div className="card">
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--gray-100)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 600, fontSize: 14 }}>
            Lançamentos
            {data?.transactions?.length > 0 && (
              <span style={{ marginLeft: 8, fontSize: 12, color: 'var(--gray-400)' }}>({data.transactions.length})</span>
            )}
          </span>
        </div>
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Data</th>
                <th>Origem</th>
                <th>Descrição</th>
                <th>Tipo</th>
                <th style={{ textAlign: 'right' }}>Valor</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={5}>
                  <div className="empty-state"><i className="fas fa-spinner fa-spin" /><p>Carregando...</p></div>
                </td></tr>
              )}
              {!loading && !data?.transactions?.length && (
                <tr><td colSpan={5}>
                  <div className="empty-state">
                    <i className="fas fa-money-bill-trend-up" />
                    <p>Nenhum lançamento no período selecionado</p>
                  </div>
                </td></tr>
              )}
              {data?.transactions?.map((t, i) => {
                const sm = SOURCE_META[t.source] || { icon: 'fa-tag', color: '#94a3b8' };
                const isEntrada = t.type === 'entrada';
                return (
                  <tr key={i}>
                    <td style={{ fontSize: 13, color: 'var(--gray-500)', whiteSpace: 'nowrap' }}>{fmtDate(t.date)}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <i className={`fas ${sm.icon}`} style={{ color: sm.color, fontSize: 12, width: 14, textAlign: 'center' }} />
                        <span style={{ fontSize: 13 }}>{t.source}</span>
                      </div>
                    </td>
                    <td style={{ fontSize: 13, color: 'var(--gray-600)' }}>{t.description || '—'}</td>
                    <td>
                      <span className={`badge ${isEntrada ? 'badge-green' : 'badge-red'}`}>
                        {isEntrada ? '↑ Entrada' : '↓ Saída'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right', fontSize: 14, fontWeight: 600, color: isEntrada ? '#22c55e' : '#ef4444', whiteSpace: 'nowrap' }}>
                      {isEntrada ? '+' : '−'}{fmt(t.amount)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
