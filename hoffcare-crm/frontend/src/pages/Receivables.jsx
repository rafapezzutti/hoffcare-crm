import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';

const STATUS = {
  pago:             { label: 'Pago',             color: '#16a34a', bg: '#dcfce7' },
  em_dia:           { label: 'Parcelas em dia',  color: '#0284c7', bg: '#e0f2fe' },
  parcela_atrasada: { label: 'Parcela atrasada', color: '#d97706', bg: '#fef3c7' },
  atrasado:         { label: 'Atrasado',         color: '#dc2626', bg: '#fee2e2' },
};
const PAY = { pix: '💠 Pix', debito: '🏦 Débito', credito: '💳 Crédito' };
const SOURCE = { procedimento: 'Procedimento', orcamento: 'Orçamento', odontograma: 'Odontograma', evolucao: 'Evolução' };

const fmt = (v) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtD = (d) => d ? new Date(String(d).slice(0, 10) + 'T12:00:00').toLocaleDateString('pt-BR') : '—';

export default function Receivables() {
  const [list, setList] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fStatus, setFStatus] = useState('');
  const [fSource, setFSource] = useState('');
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (fStatus) params.status = fStatus;
      if (fSource) params.source_type = fSource;
      if (search) params.search = search;
      const [r, s] = await Promise.all([
        api.get('/receivables', { params }),
        api.get('/receivables/summary'),
      ]);
      setList(r.data);
      setSummary(s.data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [fStatus, fSource, search]);

  useEffect(() => { load(); }, [load]);

  const pagar = async (parcelaId, pago) => {
    await api.patch(`/receivables/parcelas/${parcelaId}/pagar`, { pago });
    load();
  };

  const hoje = new Date().toISOString().slice(0, 10);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Contas a Receber</h1>
          <p className="page-subtitle">Procedimentos e orçamentos — formas de pagamento, parcelas e status</p>
        </div>
        <button className="btn btn-outline" onClick={load}><i className="fas fa-rotate" /> Atualizar</button>
      </div>

      {/* Alerta de atraso */}
      {summary?.tem_atraso && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#fef9c3', border: '1px solid #facc15', borderRadius: 10, padding: '10px 16px', marginBottom: 16 }}>
          <span style={{ fontSize: 20 }}>❓</span>
          <div>
            <strong style={{ color: '#854d0e' }}>Questões financeiras requerem sua atenção</strong>
            <div style={{ fontSize: 12, color: '#a16207' }}>{summary.parcelas_vencidas} parcela{summary.parcelas_vencidas > 1 ? 's' : ''} vencida{summary.parcelas_vencidas > 1 ? 's' : ''} em aberto.</div>
          </div>
        </div>
      )}

      {/* Aging 30/60/90 */}
      {summary && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 20 }}>
          {[
            ['A vencer 30d', summary.a_vencer_30, '#0284c7'],
            ['A vencer 60d', summary.a_vencer_60, '#0ea5e9'],
            ['A vencer 90d+', Number(summary.a_vencer_90) + Number(summary.a_vencer_90mais), '#38bdf8'],
            ['Vencido até 30d', summary.vencido_30, '#f59e0b'],
            ['Vencido 30–60d', summary.vencido_60, '#ef4444'],
            ['Vencido 60d+', summary.vencido_60mais, '#b91c1c'],
            ['Total em aberto', summary.total_aberto, '#6366f1'],
          ].map(([l, v, c]) => (
            <div key={l} className="card" style={{ padding: '12px 16px' }}>
              <div style={{ fontSize: 11, color: 'var(--gray-500)', marginBottom: 2 }}>{l}</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: c }}>{fmt(v)}</div>
            </div>
          ))}
        </div>
      )}

      {/* Filtros */}
      <div className="card" style={{ marginBottom: 16, padding: '14px 20px' }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <input className="form-control" style={{ width: 220 }} placeholder="Buscar paciente ou descrição..."
            value={search} onChange={e => setSearch(e.target.value)} />
          <select className="form-control" style={{ width: 170 }} value={fStatus} onChange={e => setFStatus(e.target.value)}>
            <option value="">Todos os status</option>
            {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <select className="form-control" style={{ width: 160 }} value={fSource} onChange={e => setFSource(e.target.value)}>
            <option value="">Todas as origens</option>
            <option value="procedimento">Procedimentos</option>
            <option value="orcamento">Orçamentos</option>
          </select>
        </div>
      </div>

      {/* Tabela */}
      <div className="card">
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Paciente</th><th>Origem</th><th>Descrição</th><th>Pagamento</th>
                <th>Total</th><th>Parcelas</th><th>Próx. venc.</th><th>Status</th><th></th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={9}><div className="empty-state"><i className="fas fa-spinner fa-spin" /><p>Carregando...</p></div></td></tr>}
              {!loading && list.length === 0 && (
                <tr><td colSpan={9}><div className="empty-state"><i className="fas fa-file-invoice-dollar" /><p>Nenhum título encontrado. Eles são gerados ao salvar um procedimento ou orçamento com forma de pagamento.</p></div></td></tr>
              )}
              {!loading && list.map(r => {
                const st = STATUS[r.status] || STATUS.em_dia;
                const pagas = r.parcelas.filter(p => p.pago).length;
                const prox = r.parcelas.find(p => !p.pago);
                const isOpen = expanded === r.id;
                return [
                  <tr key={r.id} onClick={() => setExpanded(isOpen ? null : r.id)} style={{ cursor: 'pointer' }}>
                    <td style={{ fontWeight: 600, fontSize: 13 }}>{r.patient_name || '—'}</td>
                    <td style={{ fontSize: 12 }}>{SOURCE[r.source_type] || r.source_type}</td>
                    <td style={{ fontSize: 12, color: 'var(--gray-500)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.descricao || '—'}</td>
                    <td style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{PAY[r.payment_method] || r.payment_method}{r.installments > 1 ? ` ${r.installments}x` : ''}</td>
                    <td style={{ fontWeight: 600 }}>{fmt(r.total)}</td>
                    <td style={{ fontSize: 12 }}>{pagas}/{r.parcelas.length}</td>
                    <td style={{ fontSize: 12, color: prox && String(prox.vencimento).slice(0, 10) < hoje ? '#dc2626' : undefined, fontWeight: prox && String(prox.vencimento).slice(0, 10) < hoje ? 600 : undefined }}>
                      {prox ? fmtD(prox.vencimento) : '—'}
                    </td>
                    <td><span style={{ fontSize: 11, fontWeight: 600, color: st.color, background: st.bg, padding: '3px 8px', borderRadius: 5, whiteSpace: 'nowrap' }}>{st.label}</span></td>
                    <td><i className={`fas fa-chevron-${isOpen ? 'up' : 'down'}`} style={{ fontSize: 11, color: 'var(--gray-400)' }} /></td>
                  </tr>,
                  isOpen && (
                    <tr key={`${r.id}-d`}>
                      <td colSpan={9} style={{ background: 'var(--gray-50, #f8fafc)', padding: '10px 20px' }}>
                        <table style={{ width: '100%', fontSize: 12 }}>
                          <thead><tr style={{ color: 'var(--gray-500)' }}><th align="left">Parcela</th><th align="left">Valor</th><th align="left">Vencimento</th><th align="left">Situação</th><th align="right">Ação</th></tr></thead>
                          <tbody>
                            {r.parcelas.map(p => {
                              const vencida = !p.pago && String(p.vencimento).slice(0, 10) < hoje;
                              return (
                                <tr key={p.id} style={{ borderTop: '1px solid var(--gray-100, #f1f5f9)' }}>
                                  <td>{p.num}/{r.parcelas.length}</td>
                                  <td>{fmt(p.valor)}</td>
                                  <td style={{ color: vencida ? '#dc2626' : undefined }}>{fmtD(p.vencimento)}{vencida && ' ⚠️'}</td>
                                  <td>{p.pago ? <span style={{ color: '#16a34a' }}>Paga em {fmtD(p.pago_em)}</span> : vencida ? <span style={{ color: '#dc2626' }}>Vencida</span> : 'Em aberto'}</td>
                                  <td align="right">
                                    {p.pago
                                      ? <button className="btn btn-outline btn-sm" onClick={(e) => { e.stopPropagation(); pagar(p.id, false); }}>Desfazer</button>
                                      : <button className="btn btn-outline btn-sm" style={{ color: '#16a34a', borderColor: '#16a34a' }} onClick={(e) => { e.stopPropagation(); pagar(p.id, true); }}><i className="fas fa-check" /> Dar baixa</button>}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  ),
                ];
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
