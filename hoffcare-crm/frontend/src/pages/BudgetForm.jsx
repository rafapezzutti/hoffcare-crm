import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import api from '../services/api';
import Modal from '../components/Modal';
import dayjs from 'dayjs';

export default function BudgetForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const isEdit = !!id;

  // Pré-preenche paciente vindo do perfil do paciente (?patient_id=X&patient_name=Y)
  const urlParams = new URLSearchParams(location.search);
  const prePatientId   = urlParams.get('patient_id');
  const prePatientName = urlParams.get('patient_name');

  // Form state
  const [form, setForm] = useState({
    patient_id: '',
    professional_id: '',
    valid_until: dayjs().add(30, 'day').format('YYYY-MM-DD'),
    notes: '',
    status: 'rascunho',
    payment_method: null,
    installments: 1,
  });
  const [items, setItems] = useState([]); // { procedure_id, procedure_name, qty, unit_value }

  // Data
  const [professionals, setProfessionals] = useState([]);
  const [allProcedures, setAllProcedures] = useState([]);
  const [budgetNumber, setBudgetNumber] = useState('');

  // Patient autocomplete
  const [patients, setPatients] = useState([]);
  const [patientSearch, setPatientSearch] = useState('');
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [showPatientList, setShowPatientList] = useState(false);
  const patientSearchTimeout = useRef(null);

  // Procedure search
  const [procSearch, setProcSearch] = useState('');
  const [showProcList, setShowProcList] = useState(false);

  // UI state
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(isEdit);

  // Email modal
  const [emailModal, setEmailModal] = useState(false);
  const [emailAddress, setEmailAddress] = useState('');
  const [emailSending, setEmailSending] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [emailSuccess, setEmailSuccess] = useState(false);
  const [savedId, setSavedId] = useState(id || null);

  // Load initial data
  useEffect(() => {
    Promise.all([
      api.get('/professionals').catch(() => ({ data: [] })),
      api.get('/procedures').catch(() => ({ data: [] })),
    ]).then(([pr, proc]) => {
      setProfessionals(pr.data);
      setAllProcedures(proc.data);
    });

    // Pré-preenche paciente se veio do perfil (?patient_id=X&patient_name=Y)
    if (!isEdit && prePatientId && prePatientName) {
      setForm(p => ({ ...p, patient_id: prePatientId }));
      setSelectedPatient({ id: prePatientId, name: prePatientName });
      setPatientSearch(prePatientName);
    }

    if (isEdit) {
      setLoading(true);
      api.get(`/budgets/${id}`)
        .then(res => {
          const b = res.data;
          setForm({
            patient_id: b.patient_id,
            professional_id: b.professional_id,
            valid_until: b.valid_until ? b.valid_until.slice(0, 10) : '',
            notes: b.notes || '',
            status: b.status,
            payment_method: b.payment_method || null,
            installments: b.installments || 1,
          });
          setSelectedPatient({ id: b.patient_id, name: b.patient_name });
          setPatientSearch(b.patient_name || '');
          setBudgetNumber(b.number || `ORC-${String(b.id).padStart(6, '0')}`);
          setItems((b.items || []).map(i => ({
            procedure_id: i.procedure_id,
            procedure_name: i.procedure_name,
            qty: i.qty || 1,
            unit_value: i.unit_value || 0,
          })));
          setSavedId(b.id);
        })
        .catch(() => setError('Erro ao carregar orçamento.'))
        .finally(() => setLoading(false));
    }
  }, [id]);

  // Patient search with debounce
  useEffect(() => {
    clearTimeout(patientSearchTimeout.current);
    if (!patientSearch || (selectedPatient && selectedPatient.name === patientSearch)) return;
    patientSearchTimeout.current = setTimeout(async () => {
      try {
        const res = await api.get(`/patients?search=${encodeURIComponent(patientSearch)}`);
        setPatients(res.data);
        setShowPatientList(true);
      } catch {
        setPatients([]);
      }
    }, 300);
    return () => clearTimeout(patientSearchTimeout.current);
  }, [patientSearch]);

  // Filtered procedures
  const filteredProcs = allProcedures
    .filter(p => procSearch === '' || p.name.toLowerCase().includes(procSearch.toLowerCase()) || (p.code || '').includes(procSearch))
    .slice(0, 15);

  // Items total
  const total = items.reduce((s, i) => s + (parseFloat(i.qty || 0) * parseFloat(i.unit_value || 0)), 0);

  const addProcedure = (proc) => {
    setItems(prev => [...prev, {
      procedure_id: proc.id,
      procedure_name: proc.name,
      qty: 1,
      unit_value: parseFloat(proc.value || proc.price || 0),
    }]);
    setProcSearch('');
    setShowProcList(false);
  };

  const addManualItem = () => {
    setItems(prev => [...prev, { procedure_id: null, procedure_name: '', qty: 1, unit_value: 0 }]);
  };

  const updateItem = (idx, field, value) => {
    setItems(prev => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item));
  };

  const removeItem = (idx) => {
    setItems(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSave = async () => {
    if (!form.patient_id) { setError('Paciente é obrigatório.'); return; }
    if (!form.professional_id) { setError('Profissional é obrigatório.'); return; }
    if (items.length === 0) { setError('Adicione pelo menos um procedimento/item.'); return; }

    setSaving(true); setError('');
    try {
      const payload = { ...form, items, total };
      let res;
      if (isEdit) {
        res = await api.put(`/budgets/${id}`, payload);
        setSavedId(id);
      } else {
        res = await api.post('/budgets', payload);
        setSavedId(res.data.id);
        navigate(`/budgets/${res.data.id}/edit`, { replace: true });
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao salvar orçamento.');
    } finally {
      setSaving(false);
    }
  };

  const handleSendEmail = async () => {
    if (!emailAddress.trim()) { setEmailError('Informe o e-mail.'); return; }
    setEmailSending(true); setEmailError(''); setEmailSuccess(false);
    try {
      await api.post(`/budgets/${savedId}/send-email`, {
        email: emailAddress,
        patient_name: selectedPatient?.name || '',
      });
      setEmailSuccess(true);
    } catch (err) {
      setEmailError(err.response?.data?.error || 'Erro ao enviar e-mail.');
    } finally {
      setEmailSending(false);
    }
  };

  const ff = (field) => ({
    value: form[field] ?? '',
    onChange: e => setForm(p => ({ ...p, [field]: e.target.value })),
  });

  if (loading) {
    return (
      <div className="page">
        <div style={{ textAlign: 'center', padding: 80, color: 'var(--gray-400)' }}>
          <i className="fas fa-spinner fa-spin" style={{ fontSize: 32 }} />
          <p style={{ marginTop: 12 }}>Carregando orçamento...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      {/* Header */}
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="btn btn-outline btn-sm" onClick={() => navigate('/budgets')}>
            <i className="fas fa-arrow-left" />
          </button>
          <h1 className="page-title">
            {isEdit
              ? `Editar Orçamento ${budgetNumber ? '#' + budgetNumber : ''}`
              : 'Novo Orçamento'}
          </h1>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {savedId && (
            <>
              <button
                className="btn btn-outline"
                onClick={() => window.open(`/budgets/${savedId}/print`, '_blank')}
              >
                <i className="fas fa-print" /> Imprimir
              </button>
              <button
                className="btn btn-outline"
                style={{ color: 'var(--blue)', borderColor: 'var(--blue)' }}
                onClick={() => { setEmailAddress(selectedPatient?.email || ''); setEmailModal(true); }}
              >
                <i className="fas fa-envelope" /> Enviar por E-mail
              </button>
            </>
          )}
          <button className="btn btn-outline" onClick={() => navigate('/budgets')}>Cancelar</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Salvando...' : <><i className="fas fa-save" /> Salvar</>}
          </button>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 20 }}>
        {/* Left column: form fields */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Informações do Orçamento</span>
          </div>

          {/* Patient search */}
          <div className="form-group" style={{ position: 'relative' }}>
            <label className="form-label">Paciente <span className="required">*</span></label>
            <input
              className="form-control"
              placeholder="Buscar paciente pelo nome ou CPF..."
              value={patientSearch}
              onChange={e => {
                setPatientSearch(e.target.value);
                setForm(p => ({ ...p, patient_id: '' }));
                setSelectedPatient(null);
              }}
              onFocus={() => patientSearch && setShowPatientList(true)}
              onBlur={() => setTimeout(() => setShowPatientList(false), 180)}
            />
            {showPatientList && patients.length > 0 && (
              <div style={{
                position: 'absolute', zIndex: 20, width: '100%', background: 'white',
                border: '1px solid var(--gray-200)', borderRadius: 6,
                maxHeight: 200, overflowY: 'auto', boxShadow: 'var(--shadow)',
              }}>
                {patients.slice(0, 8).map(p => (
                  <div
                    key={p.id}
                    style={{ padding: '9px 14px', cursor: 'pointer', fontSize: 13, borderBottom: '1px solid var(--gray-100)' }}
                    onMouseDown={() => {
                      setForm(f => ({ ...f, patient_id: p.id }));
                      setPatientSearch(p.name);
                      setSelectedPatient(p);
                      setShowPatientList(false);
                    }}
                  >
                    <strong>{p.name}</strong>
                    {p.cpf && <span style={{ color: 'var(--gray-400)', marginLeft: 8, fontSize: 12 }}>{p.cpf}</span>}
                  </div>
                ))}
              </div>
            )}
            {selectedPatient && (
              <div style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 4 }}>
                <i className="fas fa-check-circle" style={{ color: 'var(--success)', marginRight: 4 }} />
                Paciente vinculado: {selectedPatient.name}
              </div>
            )}
          </div>

          {/* Professional */}
          <div className="form-group">
            <label className="form-label">Profissional <span className="required">*</span></label>
            <select className="form-control" {...ff('professional_id')}>
              <option value="">Selecione...</option>
              {professionals.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name}{p.crm_cro ? ` (${p.crm_cro})` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Valid until */}
          <div className="form-group">
            <label className="form-label">Válido até</label>
            <input className="form-control" type="date" {...ff('valid_until')} />
          </div>

          {/* Forma de pagamento (quando o orçamento for fechado) */}
          <div className="form-group">
            <label className="form-label">Forma de pagamento <span style={{ fontWeight: 400, color: 'var(--gray-400)', fontSize: 11 }}>(defina ao fechar — gera o contas a receber)</span></label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
              {[{ v: null, l: 'Não definida' }, { v: 'pix', l: '💠 Pix' }, { v: 'debito', l: '🏦 Débito' }, { v: 'credito', l: '💳 Crédito' }].map(opt => (
                <button key={opt.v ?? 'null'} type="button"
                  onClick={() => setForm(f => ({ ...f, payment_method: opt.v, installments: opt.v === 'credito' ? (f.installments || 1) : 1 }))}
                  style={{
                    padding: '5px 12px', borderRadius: 6, border: '1px solid', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    background: form.payment_method === opt.v ? '#22c55e' : 'white',
                    color: form.payment_method === opt.v ? 'white' : 'var(--gray-500)',
                    borderColor: form.payment_method === opt.v ? '#22c55e' : 'var(--gray-200)',
                  }}>{opt.l}</button>
              ))}
            </div>
            {form.payment_method === 'credito' && (
              <select className="form-control" style={{ maxWidth: 220 }}
                value={form.installments}
                onChange={e => setForm(f => ({ ...f, installments: parseInt(e.target.value) }))}>
                {Array.from({ length: 12 }, (_, i) => i + 1).map(n => (
                  <option key={n} value={n}>{n}x de R$ {total > 0 ? (total / n).toFixed(2) : '0.00'} sem juros</option>
                ))}
              </select>
            )}
          </div>

          {/* Notes */}
          <div className="form-group">
            <label className="form-label">Observações</label>
            <textarea className="form-control" rows={4} {...ff('notes')} placeholder="Condições de pagamento, prazo, informações adicionais..." />
          </div>
        </div>

        {/* Right column: procedure items */}
        <div className="card">
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="card-title">Procedimentos / Itens</span>
            <button className="btn btn-outline btn-sm" onClick={addManualItem} style={{ fontSize: 12 }}>
              <i className="fas fa-pencil" style={{ marginRight: 4 }} /> Manual
            </button>
          </div>

          {/* Procedure search */}
          <div style={{ position: 'relative', marginBottom: 14 }}>
            <div className="search-input-wrapper">
              <i className="fas fa-search" />
              <input
                className="form-control"
                placeholder="Buscar procedimento para adicionar..."
                value={procSearch}
                onChange={e => { setProcSearch(e.target.value); setShowProcList(true); }}
                onFocus={() => procSearch && setShowProcList(true)}
                onBlur={() => setTimeout(() => setShowProcList(false), 180)}
              />
            </div>
            {showProcList && procSearch && (
              <div style={{
                position: 'absolute', zIndex: 20, width: '100%', background: 'white',
                border: '1px solid var(--gray-200)', borderRadius: 6,
                maxHeight: 200, overflowY: 'auto', boxShadow: 'var(--shadow)',
              }}>
                {filteredProcs.map(p => (
                  <div
                    key={p.id}
                    style={{ padding: '8px 14px', cursor: 'pointer', fontSize: 12, borderBottom: '1px solid var(--gray-100)' }}
                    onMouseDown={() => addProcedure(p)}
                  >
                    {p.code && (
                      <span style={{ fontFamily: 'monospace', color: 'var(--gray-400)', marginRight: 8 }}>{p.code}</span>
                    )}
                    {p.name.length > 70 ? p.name.slice(0, 70) + '...' : p.name}
                  </div>
                ))}
                {filteredProcs.length === 0 && (
                  <div style={{ padding: '10px 14px', color: 'var(--gray-400)', fontSize: 12 }}>Nenhum procedimento encontrado</div>
                )}
              </div>
            )}
          </div>

          {/* Items table */}
          {items.length === 0 ? (
            <div className="empty-state" style={{ padding: 32 }}>
              <i className="fas fa-list-check" />
              <p>Busque ou adicione procedimentos acima</p>
            </div>
          ) : (
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Procedimento</th>
                    <th style={{ width: 70 }}>Qtd</th>
                    <th style={{ width: 110 }}>Valor Unit.</th>
                    <th style={{ width: 100 }}>Total</th>
                    <th style={{ width: 40 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, idx) => {
                    const lineTotal = parseFloat(item.qty || 0) * parseFloat(item.unit_value || 0);
                    return (
                      <tr key={idx}>
                        <td>
                          {item.procedure_id ? (
                            <span style={{ fontSize: 13 }}>{item.procedure_name}</span>
                          ) : (
                            <input
                              className="form-control"
                              style={{ fontSize: 13, padding: '4px 8px' }}
                              placeholder="Descreva o item..."
                              value={item.procedure_name}
                              onChange={e => updateItem(idx, 'procedure_name', e.target.value)}
                            />
                          )}
                        </td>
                        <td>
                          <input
                            className="form-control"
                            type="number"
                            min="1"
                            step="1"
                            style={{ padding: '4px 8px', fontSize: 13 }}
                            value={item.qty}
                            onChange={e => updateItem(idx, 'qty', e.target.value)}
                          />
                        </td>
                        <td>
                          <input
                            className="form-control"
                            type="number"
                            min="0"
                            step="0.01"
                            style={{ padding: '4px 8px', fontSize: 13 }}
                            value={item.unit_value}
                            onChange={e => updateItem(idx, 'unit_value', e.target.value)}
                          />
                        </td>
                        <td style={{ fontWeight: 700, fontSize: 13 }}>
                          R$ {lineTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </td>
                        <td>
                          <button className="btn btn-danger btn-sm btn-icon" onClick={() => removeItem(idx)}>
                            <i className="fas fa-times" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {items.length > 0 && (
            <div style={{
              marginTop: 12, padding: '12px 16px',
              background: 'var(--gray-50)', borderRadius: 8,
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              border: '1px solid var(--gray-200)',
            }}>
              <span style={{ fontWeight: 600, color: 'var(--gray-600)', fontSize: 14 }}>
                Total do Orçamento
              </span>
              <span style={{ fontWeight: 800, fontSize: 22, color: 'var(--success)' }}>
                R$ {total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Email Modal */}
      <Modal
        open={emailModal}
        onClose={() => { setEmailModal(false); setEmailSuccess(false); setEmailError(''); }}
        title="Enviar Orçamento por E-mail"
        footer={
          !emailSuccess ? (
            <>
              <button className="btn btn-outline" onClick={() => setEmailModal(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleSendEmail} disabled={emailSending}>
                {emailSending ? 'Enviando...' : <><i className="fas fa-paper-plane" /> Enviar</>}
              </button>
            </>
          ) : (
            <button className="btn btn-primary" onClick={() => { setEmailModal(false); setEmailSuccess(false); }}>Fechar</button>
          )
        }
      >
        {emailSuccess ? (
          <div style={{ textAlign: 'center', padding: 20 }}>
            <i className="fas fa-check-circle" style={{ fontSize: 40, color: 'var(--success)', marginBottom: 12, display: 'block' }} />
            <p style={{ fontWeight: 600 }}>E-mail enviado com sucesso!</p>
            {selectedPatient?.name && <p style={{ color: 'var(--gray-500)', fontSize: 13 }}>Para: {selectedPatient.name}</p>}
          </div>
        ) : (
          <>
            {emailError && <div className="alert alert-error">{emailError}</div>}
            {selectedPatient?.name && (
              <div style={{ marginBottom: 12, fontSize: 13, color: 'var(--gray-600)' }}>
                <i className="fas fa-user" style={{ marginRight: 6 }} />
                Paciente: <strong>{selectedPatient.name}</strong>
              </div>
            )}
            <div className="form-group">
              <label className="form-label">E-mail do destinatário <span className="required">*</span></label>
              <input
                className="form-control"
                type="email"
                placeholder="email@exemplo.com"
                value={emailAddress}
                onChange={e => setEmailAddress(e.target.value)}
              />
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}
