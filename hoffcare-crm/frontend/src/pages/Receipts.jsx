import { useState, useEffect } from 'react';
import api from '../services/api';
import dayjs from 'dayjs';

const PAYMENT_LABELS = {
  pix:     'PIX',
  debito:  'Débito',
  credito: 'Crédito',
  dinheiro:'Dinheiro',
  boleto:  'Boleto',
};

const fmt = v => parseFloat(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const emptyForm = {
  patient_name: '', patient_id: '',
  source_type: 'avulso', source_id: '',
  amount: '', payment_method: 'pix', payment_description: '',
  description: '', professional_name: '',
  issue_now: true,
};

export default function Receipts() {
  const [receipts,   setReceipts]   = useState([]);
  const [alerts,     setAlerts]     = useState({ overdue_installments: [], no_payment_method: [], no_receipt: [] });
  const [patients,   setPatients]   = useState([]);
  const [tab,        setTab]        = useState('receipts'); // 'receipts' | 'alerts'
  const [loading,    setLoading]    = useState(false);
  const [modalOpen,  setModalOpen]  = useState(false);
  const [editing,    setEditing]    = useState(null);
  const [form,       setForm]       = useState(emptyForm);
  const [saving,     setSaving]     = useState(false);
  const [error,      setError]      = useState('');

  // Filtros
  const [filterIssued, setFilterIssued] = useState('');
  const [filterSent,   setFilterSent]   = useState('');
  const [filterSearch, setFilterSearch] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterIssued) params.set('issued', filterIssued);
      if (filterSent)   params.set('sent',   filterSent);
      const [r, a, p] = await Promise.all([
        api.get(`/receipts?${params}`),
        api.get('/receipts/alerts'),
        api.get('/patients?limit=200').catch(() => ({ data: [] })),
      ]);
      setReceipts(r.data);
      setAlerts(a.data);
      setPatients(p.data?.patients || p.data || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [filterIssued, filterSent]);

  const openNew = () => {
    setEditing(null);
    setForm(emptyForm);
    setError('');
    setModalOpen(true);
  };

  const openEdit = (r) => {
    setEditing(r);
    setForm({
      patient_name:        r.patient_name || '',
      patient_id:          r.patient_id   || '',
      source_type:         r.source_type  || 'avulso',
      source_id:           r.source_id    || '',
      amount:              r.amount       || '',
      payment_method:      r.payment_method || 'pix',
      payment_description: r.payment_description || '',
      description:         r.description  || '',
      professional_name:   r.professional_name || '',
      issue_now:           !!r.issued_at,
    });
    setError('');
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.amount || parseFloat(form.amount) <= 0) { setError('Informe o valor do recibo.'); return; }
    setSaving(true); setError('');
    try {
      if (editing) {
        await api.put(`/receipts/${editing.id}`, {
          ...form,
          issued_at: form.issue_now ? (editing.issued_at || new Date().toISOString()) : null,
        });
      } else {
        await api.post('/receipts', form);
      }
      setModalOpen(false);
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao salvar.');
    } finally {
      setSaving(false);
    }
  };

  const markSent = async (r) => {
    const to = prompt('E-mail ou canal de envio (ex: WhatsApp):', r.sent_to || r.patient_name);
    if (to === null) return;
    try {
      await api.put(`/receipts/${r.id}`, {
        ...r,
        issued_at: r.issued_at || new Date().toISOString(),
        sent_at:   new Date().toISOString(),
        sent_to:   to,
      });
      load();
    } catch { alert('Erro ao marcar envio.'); }
  };

  const handleDelete = async (id) => {
    if (!confirm('Excluir este recibo?')) return;
    await api.delete(`/receipts/${id}`);
    load();
  };

  const printReceipt = (r) => {
    const w = window.open('', '_blank');
    w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8">
      <title>Recibo — ${r.patient_name || 'Paciente'}</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: Arial, sans-serif; font-size: 13px; color: #1a1a1a; padding: 40px; max-width: 600px; margin: 0 auto; }
        .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #1a2535; padding-bottom: 16px; margin-bottom: 24px; }
        .logo { font-size: 20px; font-weight: 800; color: #4DB8E8; }
        .logo span { color: #E8841A; font-size: 12px; display: block; }
        h1 { font-size: 22px; font-weight: 800; color: #1a2535; text-align: center; margin-bottom: 6px; }
        .subtitle { text-align: center; color: #6c757d; font-size: 12px; margin-bottom: 28px; }
        .amount-box { background: #1a2535; color: #4DB8E8; border-radius: 10px; padding: 20px; text-align: center; margin: 24px 0; }
        .amount-label { font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #adb5bd; margin-bottom: 6px; }
        .amount-val { font-size: 36px; font-weight: 800; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 28px; }
        td { padding: 8px 0; border-bottom: 1px solid #f1f5f9; font-size: 13px; }
        td:first-child { color: #6c757d; width: 140px; }
        td:last-child { font-weight: 600; }
        .signature { display: flex; justify-content: space-between; margin-top: 48px; padding-top: 12px; border-top: 1px dashed #adb5bd; }
        .sig-line { text-align: center; width: 46%; }
        .sig-line div { border-top: 1px solid #1a2535; padding-top: 6px; margin-top: 48px; font-size: 11px; color: #6c757d; }
        @media print { body { padding: 20px; } }
      </style>
    </head><body>
      <div class="header">
        <div><div class="logo">P. Soluções<span>para Saúde</span></div></div>
        <div style="text-align:right;font-size:11px;color:#6c757d">
          Recibo nº ${r.id}<br/>
          ${r.issued_at ? dayjs(r.issued_at).format('DD/MM/YYYY') : dayjs().format('DD/MM/YYYY')}
        </div>
      </div>
      <h1>RECIBO DE PAGAMENTO</h1>
      <div class="subtitle">Documento válido como comprovante de pagamento</div>
      <div class="amount-box">
        <div class="amount-label">Valor Recebido</div>
        <div class="amount-val">R$ ${fmt(r.amount)}</div>
      </div>
      <table>
        <tr><td>Paciente</td><td>${r.patient_name || '—'}</td></tr>
        <tr><td>Serviço / Descrição</td><td>${r.description || '—'}</td></tr>
        <tr><td>Forma de Pagamento</td><td>${PAYMENT_LABELS[r.payment_method] || r.payment_method}${r.payment_description ? ' — ' + r.payment_description : ''}</td></tr>
        ${r.professional_name ? `<tr><td>Profissional</td><td>${r.professional_name}</td></tr>` : ''}
        <tr><td>Data</td><td>${r.issued_at ? dayjs(r.issued_at).format('DD/MM/YYYY') : dayjs().format('DD/MM/YYYY')}</td></tr>
      </table>
      <div class="signature">
        <div class="sig-line"><div>Assinatura do Responsável</div></div>
        <div class="sig-line"><div>Assinatura do Paciente</div></div>
      </div>
    </body></html>`);
    w.document.close();
    setTimeout(() => { w.focus(); w.print(); }, 400);
  };

  const totalAlerts = alerts.overdue_installments.length + alerts.no_payment_method.length + alerts.no_receipt.length;

  const filteredReceipts = receipts.filter(r =>
    !filterSearch ||
    (r.patient_name || '').toLowerCase().includes(filterSearch.toLowerCase()) ||
    (r.description  || '').toLowerCase().includes(filterSearch.toLowerCase())
  );

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">
            <i className="fas fa-receipt" style={{ marginRight: 10, color: 'var(--blue)' }} />
            Recibos
          </h1>
          <p className="page-subtitle">Controle de emissão e envio de recibos</p>
        </div>
        <button className="btn btn-primary" onClick={openNew}>
          <i className="fas fa-plus" /> Novo Recibo
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '2px solid var(--gray-200)', paddingBottom: 0 }}>
        {[
          { key: 'receipts', label: 'Recibos', icon: 'fa-receipt' },
          { key: 'alerts',   label: `Alertas${totalAlerts > 0 ? ` (${totalAlerts})` : ''}`, icon: 'fa-triangle-exclamation' },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            style={{
              padding: '10px 18px', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 13,
              background: 'none', borderBottom: tab === t.key ? '2px solid var(--blue)' : '2px solid transparent',
              color: tab === t.key ? 'var(--blue)' : 'var(--gray-500)',
              marginBottom: -2,
            }}>
            <i className={`fas ${t.icon}`} style={{ marginRight: 6 }} />{t.label}
          </button>
        ))}
      </div>

      {/* ── Tab Recibos ── */}
      {tab === 'receipts' && (
        <>
          {/* Filtros */}
          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div style={{ flex: 2, minWidth: 180 }}>
                <input className="form-control" placeholder="Buscar por paciente ou descrição..."
                  value={filterSearch} onChange={e => setFilterSearch(e.target.value)} />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--gray-500)', display: 'block', marginBottom: 4 }}>Emitido</label>
                <select className="form-control" value={filterIssued} onChange={e => setFilterIssued(e.target.value)}>
                  <option value="">Todos</option>
                  <option value="true">Emitido</option>
                  <option value="false">Não emitido</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--gray-500)', display: 'block', marginBottom: 4 }}>Enviado</label>
                <select className="form-control" value={filterSent} onChange={e => setFilterSent(e.target.value)}>
                  <option value="">Todos</option>
                  <option value="true">Enviado</option>
                  <option value="false">Não enviado</option>
                </select>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="loading"><div className="spinner" /></div>
          ) : filteredReceipts.length === 0 ? (
            <div className="card">
              <div className="empty-state">
                <i className="fas fa-receipt" />
                <p>Nenhum recibo encontrado.</p>
                <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={openNew}>
                  <i className="fas fa-plus" /> Criar primeiro recibo
                </button>
              </div>
            </div>
          ) : (
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Paciente</th>
                    <th>Descrição</th>
                    <th>Pagamento</th>
                    <th style={{ textAlign: 'right' }}>Valor</th>
                    <th>Emitido</th>
                    <th>Enviado</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredReceipts.map(r => (
                    <tr key={r.id}>
                      <td style={{ fontWeight: 600 }}>{r.patient_name || '—'}</td>
                      <td style={{ fontSize: 12, color: 'var(--gray-500)', maxWidth: 200 }}>
                        {r.description || '—'}
                        {r.source_type && r.source_type !== 'avulso' && (
                          <span style={{ marginLeft: 6, fontSize: 10, background: 'var(--gray-100)', padding: '1px 6px', borderRadius: 10 }}>
                            {r.source_type === 'record' ? 'Prontuário' : 'Orçamento'} #{r.source_id}
                          </span>
                        )}
                      </td>
                      <td style={{ fontSize: 12 }}>
                        {PAYMENT_LABELS[r.payment_method] || r.payment_method}
                        {r.payment_description && (
                          <div style={{ color: 'var(--gray-400)', fontSize: 11 }}>{r.payment_description}</div>
                        )}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: '#16a34a' }}>R$ {fmt(r.amount)}</td>
                      <td>
                        {r.issued_at ? (
                          <span className="badge badge-green">
                            <i className="fas fa-check" style={{ marginRight: 4 }} />
                            {dayjs(r.issued_at).format('DD/MM/YY')}
                          </span>
                        ) : (
                          <span className="badge badge-gray">Não emitido</span>
                        )}
                      </td>
                      <td>
                        {r.sent_at ? (
                          <span className="badge badge-blue" title={r.sent_to || ''}>
                            <i className="fas fa-paper-plane" style={{ marginRight: 4 }} />
                            {dayjs(r.sent_at).format('DD/MM/YY')}
                          </span>
                        ) : (
                          <button className="btn btn-outline btn-sm" onClick={() => markSent(r)}
                            style={{ fontSize: 11 }}>
                            <i className="fas fa-paper-plane" /> Marcar enviado
                          </button>
                        )}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button className="btn btn-outline btn-sm" title="Imprimir recibo" onClick={() => printReceipt(r)}>
                            <i className="fas fa-print" />
                          </button>
                          <button className="btn btn-outline btn-sm" title="Editar" onClick={() => openEdit(r)}>
                            <i className="fas fa-pen" />
                          </button>
                          <button className="btn btn-danger btn-sm" title="Excluir" onClick={() => handleDelete(r.id)}>
                            <i className="fas fa-trash" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* ── Tab Alertas ── */}
      {tab === 'alerts' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Parcelas em atraso */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">
                <i className="fas fa-clock" style={{ color: '#dc2626', marginRight: 8 }} />
                Parcelas em Atraso ({alerts.overdue_installments.length})
              </span>
            </div>
            {alerts.overdue_installments.length === 0 ? (
              <p style={{ color: 'var(--gray-400)', fontSize: 13 }}>Nenhuma parcela em atraso.</p>
            ) : (
              <div className="table-container">
                <table className="table">
                  <thead><tr><th>Paciente</th><th>Descrição</th><th>Parcela</th><th>Vencimento</th><th style={{ textAlign: 'right' }}>Valor</th></tr></thead>
                  <tbody>
                    {alerts.overdue_installments.map(p => (
                      <tr key={p.id}>
                        <td style={{ fontWeight: 600 }}>{p.patient_name || '—'}</td>
                        <td style={{ fontSize: 12 }}>{p.descricao || '—'}</td>
                        <td>#{p.num}</td>
                        <td>
                          <span style={{ color: '#dc2626', fontWeight: 600 }}>
                            {dayjs(p.vencimento).format('DD/MM/YYYY')}
                          </span>
                          <span style={{ marginLeft: 6, fontSize: 11, color: '#dc2626' }}>
                            ({Math.abs(dayjs().diff(dayjs(p.vencimento), 'day'))}d atraso)
                          </span>
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 700, color: '#dc2626' }}>R$ {fmt(p.valor)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Sem forma de pagamento */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">
                <i className="fas fa-credit-card" style={{ color: '#f59e0b', marginRight: 8 }} />
                Atendimentos sem Forma de Pagamento ({alerts.no_payment_method.length})
              </span>
            </div>
            {alerts.no_payment_method.length === 0 ? (
              <p style={{ color: 'var(--gray-400)', fontSize: 13 }}>Todos os atendimentos têm forma de pagamento.</p>
            ) : (
              <div className="table-container">
                <table className="table">
                  <thead><tr><th>Paciente</th><th>Data</th><th style={{ textAlign: 'right' }}>Valor</th></tr></thead>
                  <tbody>
                    {alerts.no_payment_method.map(r => (
                      <tr key={r.id}>
                        <td style={{ fontWeight: 600 }}>{r.patient_name || '—'}</td>
                        <td>{dayjs(r.consultation_date).format('DD/MM/YYYY')}</td>
                        <td style={{ textAlign: 'right', fontWeight: 700 }}>R$ {fmt(r.total_value)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Sem recibo emitido */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">
                <i className="fas fa-file-circle-xmark" style={{ color: '#7c3aed', marginRight: 8 }} />
                Pagamentos sem Recibo ({alerts.no_receipt.length})
              </span>
            </div>
            {alerts.no_receipt.length === 0 ? (
              <p style={{ color: 'var(--gray-400)', fontSize: 13 }}>Todos os pagamentos têm recibo emitido.</p>
            ) : (
              <div className="table-container">
                <table className="table">
                  <thead><tr><th>Paciente</th><th>Data</th><th>Pagamento</th><th style={{ textAlign: 'right' }}>Valor</th><th>Ação</th></tr></thead>
                  <tbody>
                    {alerts.no_receipt.map(r => (
                      <tr key={r.id}>
                        <td style={{ fontWeight: 600 }}>{r.patient_name || '—'}</td>
                        <td>{dayjs(r.consultation_date).format('DD/MM/YYYY')}</td>
                        <td style={{ fontSize: 12 }}>{PAYMENT_LABELS[r.payment_method] || r.payment_method}</td>
                        <td style={{ textAlign: 'right', fontWeight: 700 }}>R$ {fmt(r.total_value)}</td>
                        <td>
                          <button className="btn btn-outline btn-sm"
                            onClick={() => {
                              setForm({
                                ...emptyForm,
                                patient_name: r.patient_name || '',
                                source_type: 'record',
                                source_id: String(r.id),
                                amount: r.total_value || '',
                                payment_method: r.payment_method || 'pix',
                                description: `Atendimento ${dayjs(r.consultation_date).format('DD/MM/YYYY')}`,
                              });
                              setEditing(null);
                              setError('');
                              setModalOpen(true);
                              setTab('receipts');
                            }}
                            style={{ fontSize: 11, color: '#7c3aed', borderColor: '#7c3aed' }}>
                            <i className="fas fa-receipt" /> Emitir recibo
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Modal criar/editar ── */}
      {modalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 560, maxHeight: '92vh', display: 'flex', flexDirection: 'column', boxShadow: '0 8px 32px rgba(0,0,0,0.18)' }}>
            <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--gray-100)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontWeight: 700, fontSize: 16 }}>
                <i className="fas fa-receipt" style={{ marginRight: 8, color: 'var(--blue)' }} />
                {editing ? 'Editar Recibo' : 'Novo Recibo'}
              </span>
              <button onClick={() => setModalOpen(false)} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: 'var(--gray-400)' }}>×</button>
            </div>

            <form onSubmit={handleSubmit} style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              {error && <div style={{ padding: '8px 12px', borderRadius: 6, background: '#fef2f2', border: '1px solid #fca5a5', color: '#991b1b', fontSize: 13 }}>{error}</div>}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--gray-600)', display: 'block', marginBottom: 4 }}>Paciente</label>
                  <input className="form-control" placeholder="Nome do paciente"
                    value={form.patient_name}
                    onChange={e => setForm(p => ({ ...p, patient_name: e.target.value }))} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--gray-600)', display: 'block', marginBottom: 4 }}>Profissional</label>
                  <input className="form-control" placeholder="Nome do profissional"
                    value={form.professional_name}
                    onChange={e => setForm(p => ({ ...p, professional_name: e.target.value }))} />
                </div>
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--gray-600)', display: 'block', marginBottom: 4 }}>
                  Serviço / Descrição
                </label>
                <input className="form-control" placeholder="Ex: Consulta odontológica, Limpeza..."
                  value={form.description}
                  onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--gray-600)', display: 'block', marginBottom: 4 }}>
                    Valor <span style={{ color: '#dc2626' }}>*</span>
                  </label>
                  <input className="form-control" type="number" min="0" step="0.01" placeholder="0,00"
                    value={form.amount}
                    onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} required />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--gray-600)', display: 'block', marginBottom: 4 }}>Forma de Pagamento</label>
                  <select className="form-control" value={form.payment_method} onChange={e => setForm(p => ({ ...p, payment_method: e.target.value }))}>
                    {Object.entries(PAYMENT_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--gray-600)', display: 'block', marginBottom: 4 }}>
                  Descrição do pagamento <span style={{ color: 'var(--gray-400)', fontWeight: 400 }}>(opcional)</span>
                </label>
                <input className="form-control" placeholder="Ex: 3x de R$100, entrada R$200 + 2x..."
                  value={form.payment_description}
                  onChange={e => setForm(p => ({ ...p, payment_description: e.target.value }))} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--gray-600)', display: 'block', marginBottom: 4 }}>Origem</label>
                  <select className="form-control" value={form.source_type} onChange={e => setForm(p => ({ ...p, source_type: e.target.value }))}>
                    <option value="avulso">Avulso</option>
                    <option value="record">Prontuário</option>
                    <option value="budget">Orçamento</option>
                  </select>
                </div>
                {form.source_type !== 'avulso' && (
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--gray-600)', display: 'block', marginBottom: 4 }}>ID do {form.source_type === 'record' ? 'Prontuário' : 'Orçamento'}</label>
                    <input className="form-control" type="number" placeholder="Nº"
                      value={form.source_id}
                      onChange={e => setForm(p => ({ ...p, source_id: e.target.value }))} />
                  </div>
                )}
              </div>

              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
                <input type="checkbox" checked={form.issue_now} onChange={e => setForm(p => ({ ...p, issue_now: e.target.checked }))} />
                Marcar como emitido agora
              </label>

              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 8, borderTop: '1px solid var(--gray-100)' }}>
                <button type="button" className="btn btn-outline" onClick={() => setModalOpen(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  <i className={`fas ${saving ? 'fa-spinner fa-spin' : 'fa-check'}`} style={{ marginRight: 6 }} />
                  {saving ? 'Salvando...' : editing ? 'Salvar' : 'Criar Recibo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
