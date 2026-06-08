import { useState, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../services/api';
import dayjs from 'dayjs';
import { PROF_TYPES, getProfType } from '../config/professionalTypes';
import { useAuth } from '../context/AuthContext';
import OcrCapture from '../components/OcrCapture';

export default function RecordForm() {
  const { t } = useTranslation();
  const { id } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isEdit = !!id;
  const isAutonomous = !!user?.is_autonomous;

  const [form, setForm] = useState({
    type: 'medico',
    patient_id: params.get('patient_id') || '',
    professional_id: '',
    consultation_date: dayjs().format('YYYY-MM-DD'),
    procedures: [],
    repasse_type: null,
    repasse_value: '',
    payment_method: 'pix',
    installments: 1,
    payment_splits: [],
  });
  const [splitMode, setSplitMode] = useState(false);

  const [patients, setPatients] = useState([]);
  const [professionals, setProfessionals] = useState([]);
  const [allProcedures, setAllProcedures] = useState([]);
  const [patientSearch, setPatientSearch] = useState('');
  const [procSearch, setProcSearch] = useState('');
  const [showProcList, setShowProcList] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [selectedProfessional, setSelectedProfessional] = useState(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [showOcr, setShowOcr] = useState(false);
  const [ocrMsg, setOcrMsg] = useState(null); // { type: 'success'|'warning'|'error', text }

  useEffect(() => {
    Promise.all([
      api.get('/patients'),
      api.get('/professionals'),
      api.get('/procedures'),
    ]).then(([p, pr, proc]) => {
      setPatients(p.data);
      setAllProcedures(proc.data);
      setProfessionals(pr.data);

      // Autônomo: pré-seleciona automaticamente o único profissional dele
      if (isAutonomous && pr.data.length > 0 && !isEdit) {
        const prof = pr.data[0];
        setForm(f => ({ ...f, type: prof.type, professional_id: prof.id }));
        setSelectedProfessional(prof);
      }
    });

    if (params.get('patient_id')) {
      api.get(`/patients/${params.get('patient_id')}`).then(r => {
        setSelectedPatient(r.data);
        setPatientSearch(r.data.name);
      }).catch(() => {});
    }

    if (isEdit) {
      api.get(`/records/${id}`).then(r => {
        const rec = r.data;
        setForm({
          type: rec.type,
          patient_id: rec.patient_id,
          professional_id: rec.professional_id,
          consultation_date: rec.consultation_date?.slice(0, 10),
          procedures: rec.procedures || [],
          repasse_type: rec.repasse_type || null,
          repasse_value: rec.repasse_value || '',
          payment_method: rec.payment_method || 'pix',
          installments: rec.installments || 1,
          payment_splits: Array.isArray(rec.payment_splits) ? rec.payment_splits : [],
        });
        if (Array.isArray(rec.payment_splits) && rec.payment_splits.length > 1) setSplitMode(true);
        setPatientSearch(rec.patient_name);
        setSelectedPatient({ name: rec.patient_name, cpf: rec.patient_cpf });
        setSelectedProfessional({ name: rec.professional_name, crm_cro: rec.crm_cro, type: rec.type });
      });
    }
  }, [id]);

  const filteredPatients = patients.filter(p =>
    patientSearch === '' ||
    p.name.toLowerCase().includes(patientSearch.toLowerCase()) ||
    p.cpf.includes(patientSearch)
  );

  // ── OCR: busca paciente pelo CPF extraído ────────────────────────────────
  const handleOcrExtracted = (data) => {
    setShowOcr(false);
    const cpf = data.cpf ? data.cpf.replace(/\D/g, '') : '';
    if (!cpf && !data.name) {
      setOcrMsg({ type: 'warning', text: 'A IA não conseguiu identificar o paciente. Busque manualmente.' });
      return;
    }
    // Tenta encontrar o paciente na lista pelo CPF ou nome
    const found = patients.find(p =>
      (cpf && p.cpf.replace(/\D/g, '') === cpf) ||
      (data.name && p.name.toLowerCase() === data.name.toLowerCase())
    );
    if (found) {
      setForm(f => ({ ...f, patient_id: found.id }));
      setPatientSearch(found.name);
      setSelectedPatient(found);
      setOcrMsg({ type: 'success', text: `✅ Paciente encontrado: ${found.name}` });
    } else {
      const label = data.name || (cpf ? `CPF ${cpf}` : '');
      setOcrMsg({
        type: 'warning',
        text: `Paciente "${label}" não encontrado no cadastro. Cadastre-o primeiro em Pacientes → Novo Paciente.`
      });
    }
  };

  const procType = form.type === 'dentista' ? 'odontologico' : form.type;
  const filteredProcedures = allProcedures.filter(p =>
    (p.type === procType || p.type === form.type) &&
    (procSearch === '' || p.name.toLowerCase().includes(procSearch.toLowerCase()) || p.code.includes(procSearch))
  ).slice(0, 20);

  const addProcedure = (proc) => {
    setForm(f => ({
      ...f,
      procedures: [...f.procedures, { procedure_id: proc.id, procedure_name: proc.name, procedure_code: proc.code, value: '' }]
    }));
    setProcSearch(''); setShowProcList(false);
  };

  const addManualProcedure = () => {
    setForm(f => ({
      ...f,
      procedures: [...f.procedures, { procedure_id: null, procedure_name: '', procedure_code: 'MANUAL', value: '', isManual: true }]
    }));
  };

  const removeProcedure = (i) => setForm(f => ({ ...f, procedures: f.procedures.filter((_, idx) => idx !== i) }));

  const updateValue = (i, v) => setForm(f => ({
    ...f,
    procedures: f.procedures.map((p, idx) => idx === i ? { ...p, value: v } : p)
  }));

  const updateName = (i, v) => setForm(f => ({
    ...f,
    procedures: f.procedures.map((p, idx) => idx === i ? { ...p, procedure_name: v } : p)
  }));

  const total = form.procedures.reduce((s, p) => s + (parseFloat(p.value) || 0), 0);

  const handleSubmit = async () => {
    // Validações essenciais
    if (!form.patient_id) {
      setError('Paciente é obrigatório. Use a busca ou "Captura com IA" para vincular.'); return;
    }
    if (!form.professional_id) {
      setError(t('recordForm.errorRequired')); return;
    }
    if (!form.consultation_date) {
      setError('Data da consulta é obrigatória.'); return;
    }
    // Garante vínculo correto: patient_id deve existir na lista
    const patientExists = patients.find(p => p.id === form.patient_id || p.id === Number(form.patient_id));
    if (!patientExists) {
      setError('Paciente não encontrado no cadastro. Verifique o vínculo antes de salvar.'); return;
    }
    // Valida procedimentos manuais: precisam ter nome
    const emptyManual = form.procedures.find(p => p.isManual && !p.procedure_name.trim());
    if (emptyManual) { setError(t('recordForm.errorManual')); return; }

    setSaving(true); setError('');
    const payload = {
      ...form,
      payment_splits: splitMode && form.payment_splits.length > 0 ? form.payment_splits : null,
    };
    try {
      if (isEdit) await api.put(`/records/${id}`, payload);
      else { const r = await api.post('/records', payload); navigate(`/records/${r.data.id}/view`); return; }
      navigate(`/records/${id}/view`);
    } catch (err) {
      setError(err.response?.data?.error || t('recordForm.errorSave'));
    } finally { setSaving(false); }
  };

  const currentType = getProfType(form.type);

  return (
    <div className="page">
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="btn btn-outline btn-sm" onClick={() => navigate('/records')}><i className="fas fa-arrow-left" /></button>
          <h1 className="page-title">{isEdit ? t('recordForm.editRecord') : t('recordForm.newRecord')}</h1>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-outline" onClick={() => navigate('/records')}>{t('recordForm.cancel')}</button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={saving}>
            {saving ? t('recordForm.saving') : <><i className="fas fa-save" /> {t('recordForm.save')}</>}
          </button>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
        <div className="card">
          <div className="card-header"><span className="card-title">{t('recordForm.consultationInfo')}</span></div>

          {/* Especialidade — bloqueado para autônomo */}
          <div className="form-group">
            <label className="form-label">{t('recordForm.specialty')} <span className="required">*</span></label>
            {isAutonomous ? (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                background: currentType.bg, border: `1px solid ${currentType.border}33`,
                borderRadius: 6, padding: '8px 12px', fontSize: 13, fontWeight: 600, color: currentType.color
              }}>
                <span>{currentType.emoji}</span>
                <span>{currentType.labelKey ? t(currentType.labelKey) : currentType.label}</span>
              </div>
            ) : (
              <select className="form-control" value={form.type}
                onChange={e => setForm(f => ({ ...f, type: e.target.value, professional_id: '', procedures: [] }))}>
                {PROF_TYPES.map(pt => (
                  <option key={pt.value} value={pt.value}>{pt.emoji} {pt.labelKey ? t(pt.labelKey) : pt.label}</option>
                ))}
              </select>
            )}
          </div>

          {/* Paciente */}
          {showOcr && <OcrCapture type="patient" onExtracted={handleOcrExtracted} onClose={() => setShowOcr(false)} />}
          <div className="form-group" style={{ position: 'relative' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <label className="form-label" style={{ margin: 0 }}>{t('recordForm.patient')} <span className="required">*</span></label>
              <button type="button" className="btn btn-outline btn-sm" onClick={() => { setOcrMsg(null); setShowOcr(true); }}
                style={{ background: 'rgba(77,184,232,0.08)', borderColor: 'var(--blue)', color: 'var(--blue)', fontWeight: 600, fontSize: 12 }}>
                <i className="fas fa-camera" style={{ marginRight: 5 }} />Captura com IA
              </button>
            </div>
            {ocrMsg && (
              <div style={{
                padding: '8px 12px', borderRadius: 6, fontSize: 13, marginBottom: 8,
                background: ocrMsg.type === 'success' ? '#e8f5e9' : '#fff3cd',
                border: `1px solid ${ocrMsg.type === 'success' ? '#a5d6a7' : '#ffc107'}`,
                color: ocrMsg.type === 'success' ? '#2e7d32' : '#856404',
              }}>
                {ocrMsg.text}
              </div>
            )}
            <input className="form-control" placeholder={t('recordForm.searchPatient')} value={patientSearch}
              onChange={e => { setPatientSearch(e.target.value); setForm(f => ({ ...f, patient_id: '' })); setSelectedPatient(null); setOcrMsg(null); }} />
            {patientSearch && !form.patient_id && (
              <div style={{ position: 'absolute', zIndex: 10, width: '100%', background: 'white', border: '1px solid var(--gray-200)', borderRadius: 6, maxHeight: 180, overflowY: 'auto' }}>
                {filteredPatients.slice(0, 8).map(p => (
                  <div key={p.id} style={{ padding: '10px 14px', cursor: 'pointer', fontSize: 13, borderBottom: '1px solid var(--gray-100)' }}
                    onClick={() => { setForm(f => ({ ...f, patient_id: p.id })); setPatientSearch(p.name); setSelectedPatient(p); }}>
                    <strong>{p.name}</strong> — {p.cpf}
                  </div>
                ))}
              </div>
            )}
          </div>

          {selectedPatient && (
            <div style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: -10, marginBottom: 12 }}>
              CPF: {selectedPatient.cpf}
            </div>
          )}

          {/* Profissional — bloqueado para autônomo */}
          <div className="form-group">
            <label className="form-label">{t('recordForm.professional')} <span className="required">*</span></label>
            {isAutonomous && selectedProfessional ? (
              <div style={{
                background: 'var(--gray-50)', border: '1px solid var(--gray-200)',
                borderRadius: 6, padding: '8px 12px', fontSize: 13
              }}>
                <strong>{selectedProfessional.name}</strong>
                {selectedProfessional.crm_cro && (
                  <span style={{ color: 'var(--gray-500)', marginLeft: 8 }}>
                    {currentType.council}: {selectedProfessional.crm_cro}
                  </span>
                )}
              </div>
            ) : (
              <select className="form-control" value={form.professional_id}
                onChange={e => {
                  const prof = professionals.find(p => p.id == e.target.value);
                  setForm(f => ({ ...f, professional_id: e.target.value }));
                  setSelectedProfessional(prof || null);
                }}>
                <option value="">{t('recordForm.select')}</option>
                {professionals
                  .filter(p => p.type === form.type || (form.type === 'dentista' && p.type === 'odontologico'))
                  .map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name}{p.crm_cro ? ` (${p.crm_cro})` : ''}
                    </option>
                  ))}
              </select>
            )}
          </div>

          {!isAutonomous && selectedProfessional?.crm_cro && (
            <div style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: -10, marginBottom: 12 }}>
              {currentType.council}: {selectedProfessional.crm_cro}
            </div>
          )}

          <div className="form-group">
            <label className="form-label">{t('recordForm.consultationDate')}</label>
            <input className="form-control" type="date" value={form.consultation_date}
              onChange={e => setForm(f => ({ ...f, consultation_date: e.target.value }))} />
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <span className="card-title">{t('recordForm.procedures')}</span>
          </div>

          {/* Busca em lista de procedimentos cadastrados */}
          <div style={{ position: 'relative', marginBottom: 12 }}>
            <div className="search-input-wrapper">
              <i className="fas fa-search" />
              <input className="form-control" placeholder={t('recordForm.searchProcedure')}
                value={procSearch}
                onChange={e => { setProcSearch(e.target.value); setShowProcList(true); }}
                onFocus={() => setShowProcList(true)} />
            </div>
            {showProcList && procSearch && (
              <div style={{ position: 'absolute', zIndex: 10, width: '100%', background: 'white', border: '1px solid var(--gray-200)', borderRadius: 6, maxHeight: 200, overflowY: 'auto' }}>
                {filteredProcedures.map(p => (
                  <div key={p.id} style={{ padding: '8px 14px', cursor: 'pointer', fontSize: 12, borderBottom: '1px solid var(--gray-100)' }}
                    onClick={() => addProcedure(p)}>
                    <span style={{ fontFamily: 'monospace', color: 'var(--gray-400)', marginRight: 8 }}>{p.code}</span>
                    {p.name.length > 60 ? p.name.slice(0, 60) + '...' : p.name}
                  </div>
                ))}
                {filteredProcedures.length === 0 && (
                  <div style={{ padding: '10px 14px', color: 'var(--gray-400)', fontSize: 12 }}>
                    {t('recordForm.noProcedures')} {currentType.label}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Botão procedimento manual */}
          <button type="button" className="btn btn-outline btn-sm" onClick={addManualProcedure}
            style={{ marginBottom: 16, fontSize: 12, color: 'var(--gray-600)' }}>
            <i className="fas fa-pencil" style={{ marginRight: 6 }} />
            {t('recordForm.addManual')}
          </button>

          {form.procedures.length === 0 && (
            <div className="empty-state" style={{ padding: 30 }}>
              <i className="fas fa-list-check" />
              <p>{t('recordForm.addProcedures')}</p>
            </div>
          )}

          {form.procedures.map((p, i) => (
            <div key={i} className="procedure-row" style={{ alignItems: 'flex-start' }}>
              <div className="procedure-name">
                {p.isManual ? (
                  <>
                    <div style={{ fontSize: 10, color: 'var(--gray-400)', marginBottom: 3 }}>
                      <i className="fas fa-pencil" style={{ marginRight: 4 }} />{t('recordForm.manualProcedure')}
                    </div>
                    <input
                      className="form-control"
                      style={{ fontSize: 13, padding: '4px 8px' }}
                      placeholder={t('recordForm.describeProcedure')}
                      value={p.procedure_name}
                      onChange={e => updateName(i, e.target.value)}
                    />
                  </>
                ) : (
                  <>
                    <div style={{ fontSize: 11, color: 'var(--gray-400)', fontFamily: 'monospace' }}>{p.procedure_code}</div>
                    <div style={{ fontSize: 13 }}>{p.procedure_name.length > 50 ? p.procedure_name.slice(0, 50) + '...' : p.procedure_name}</div>
                  </>
                )}
              </div>
              <div className="procedure-value">
                <input className="form-control" type="number" step="0.01" min="0" placeholder="R$ 0,00"
                  value={p.value} onChange={e => updateValue(i, e.target.value)} />
              </div>
              <button className="btn btn-danger btn-sm btn-icon" onClick={() => removeProcedure(i)}>
                <i className="fas fa-times" />
              </button>
            </div>
          ))}

          {form.procedures.length > 0 && (
            <div className="total-box">
              <span>{t('recordForm.totalProcedures')}</span>
              <span style={{ fontSize: 20 }}>R$ {total.toFixed(2)}</span>
            </div>
          )}

          {/* ── Forma de pagamento ── */}
          {(() => {
            const PAY_OPTS = [
              { v: 'pix',     l: '💠 Pix' },
              { v: 'debito',  l: '🏦 Débito' },
              { v: 'credito', l: '💳 Crédito' },
              { v: 'dinheiro',l: '💵 Dinheiro' },
              { v: 'boleto',  l: '📄 Boleto' },
            ];
            const addSplit = () => setForm(f => ({
              ...f,
              payment_splits: [...f.payment_splits, { method: 'pix', amount: '', installments: 1 }],
            }));
            const removeSplit = (i) => setForm(f => ({
              ...f,
              payment_splits: f.payment_splits.filter((_, idx) => idx !== i),
            }));
            const updateSplit = (i, field, value) => setForm(f => ({
              ...f,
              payment_splits: f.payment_splits.map((s, idx) => idx === i ? { ...s, [field]: value } : s),
            }));
            const splitTotal = form.payment_splits.reduce((s, sp) => s + (parseFloat(sp.amount) || 0), 0);
            const splitDiff = total - splitTotal;

            return (
              <div style={{ marginTop: 16, background: 'rgba(34,197,94,0.05)', border: '1px solid rgba(34,197,94,0.25)', borderRadius: 8, padding: '10px 14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, fontSize: 13, margin: 0, color: 'var(--gray-700)' }}>
                    <i className="fas fa-credit-card" style={{ color: '#22c55e', fontSize: 12 }} />
                    Forma de pagamento
                  </label>
                  <button type="button" onClick={() => {
                    setSplitMode(m => {
                      if (!m && form.payment_splits.length === 0)
                        setForm(f => ({ ...f, payment_splits: [{ method: f.payment_method, amount: String(total || ''), installments: f.installments || 1 }] }));
                      return !m;
                    });
                  }}
                    style={{ padding: '3px 10px', border: '1px solid', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                      background: splitMode ? '#22c55e' : 'white', color: splitMode ? 'white' : 'var(--gray-500)',
                      borderColor: splitMode ? '#22c55e' : 'var(--gray-200)' }}>
                    <i className="fas fa-split" style={{ marginRight: 4 }} />Dividir
                  </button>
                </div>

                {!splitMode ? (
                  <>
                    <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
                      {PAY_OPTS.map(opt => (
                        <button key={opt.v} type="button"
                          onClick={() => setForm(f => ({ ...f, payment_method: opt.v, installments: opt.v === 'credito' ? (f.installments || 1) : 1 }))}
                          style={{
                            padding: '5px 10px', borderRadius: 6, border: '1px solid', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                            background: form.payment_method === opt.v ? '#22c55e' : 'white',
                            color: form.payment_method === opt.v ? 'white' : 'var(--gray-500)',
                            borderColor: form.payment_method === opt.v ? '#22c55e' : 'var(--gray-200)',
                          }}>{opt.l}</button>
                      ))}
                    </div>
                    {form.payment_method === 'credito' && (
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <span style={{ fontWeight: 600, color: 'var(--gray-500)', fontSize: 13 }}>Parcelamento</span>
                        <select className="form-control" style={{ maxWidth: 220 }}
                          value={form.installments}
                          onChange={e => setForm(f => ({ ...f, installments: parseInt(e.target.value) }))}>
                          {Array.from({ length: 12 }, (_, i) => i + 1).map(n => (
                            <option key={n} value={n}>
                              {n}x de R$ {total > 0 ? (total / n).toFixed(2) : '0.00'} sem juros
                            </option>
                          ))}
                        </select>
                        <span style={{ fontSize: 11, color: 'var(--gray-400)' }}>1ª parcela no ato</span>
                      </div>
                    )}
                  </>
                ) : (
                  <div>
                    {form.payment_splits.map((sp, i) => (
                      <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 8, background: '#f9fafb', borderRadius: 8, padding: '8px 10px', border: '1px solid var(--gray-200)' }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--gray-500)', minWidth: 20 }}>#{i + 1}</span>
                        <select className="form-control" style={{ flex: 1, fontSize: 12 }}
                          value={sp.method}
                          onChange={e => updateSplit(i, 'method', e.target.value)}>
                          {PAY_OPTS.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
                        </select>
                        <input type="number" className="form-control" style={{ width: 100, fontSize: 12 }}
                          placeholder="R$ valor" min="0" step="0.01"
                          value={sp.amount}
                          onChange={e => updateSplit(i, 'amount', e.target.value)} />
                        {sp.method === 'credito' && (
                          <select className="form-control" style={{ width: 80, fontSize: 12 }}
                            value={sp.installments || 1}
                            onChange={e => updateSplit(i, 'installments', parseInt(e.target.value))}>
                            {Array.from({ length: 12 }, (_, x) => x + 1).map(n => (
                              <option key={n} value={n}>{n}x</option>
                            ))}
                          </select>
                        )}
                        <button type="button" onClick={() => removeSplit(i)}
                          style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: 16, padding: '0 4px' }}>×</button>
                      </div>
                    ))}
                    <button type="button" onClick={addSplit}
                      style={{ padding: '4px 12px', border: '1px dashed var(--gray-300)', borderRadius: 6, background: 'white', color: 'var(--gray-500)', fontSize: 12, cursor: 'pointer', marginBottom: 8 }}>
                      + Adicionar método
                    </button>
                    {form.payment_splits.length > 0 && (
                      <div style={{ fontSize: 12, color: Math.abs(splitDiff) < 0.01 ? '#166534' : '#991b1b', fontWeight: 600, padding: '4px 0' }}>
                        Total dividido: R$ {splitTotal.toFixed(2)} / R$ {total.toFixed(2)}
                        {Math.abs(splitDiff) >= 0.01 && ` (diferença: R$ ${Math.abs(splitDiff).toFixed(2)})`}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })()}

          {/* ── Ajuste de repasse desta consulta ── */}
          <div style={{ marginTop: 16, background: 'rgba(77,184,232,0.05)', border: '1px solid rgba(77,184,232,0.2)', borderRadius: 8, padding: '10px 14px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, fontSize: 13, marginBottom: 8, color: 'var(--gray-700)' }}>
              <i className="fas fa-handshake-simple" style={{ color: 'var(--blue)', fontSize: 12 }} />
              Repasse desta consulta
              <span style={{ fontSize: 11, color: 'var(--gray-400)', fontWeight: 400 }}>
                {form.repasse_type ? '(ajuste manual)' : '(padrão do profissional)'}
              </span>
            </label>
            <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
              {[{v:null,l:'Padrão'},{v:'percent',l:'% Percentual'},{v:'fixed',l:'R$ Fixo'}].map(opt => (
                <button key={opt.v ?? 'null'} type="button"
                  onClick={() => setForm(f => ({ ...f, repasse_type: opt.v, repasse_value: '' }))}
                  style={{
                    padding: '4px 10px', borderRadius: 6, border: '1px solid', fontSize: 11, fontWeight: 600, cursor: 'pointer',
                    background: form.repasse_type === opt.v ? '#4DB8E8' : 'white',
                    color: form.repasse_type === opt.v ? 'white' : 'var(--gray-500)',
                    borderColor: form.repasse_type === opt.v ? '#4DB8E8' : 'var(--gray-200)',
                  }}>{opt.l}</button>
              ))}
            </div>
            {form.repasse_type && (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{ fontWeight: 600, color: 'var(--gray-500)', fontSize: 13 }}>
                  {form.repasse_type === 'percent' ? '%' : 'R$'}
                </span>
                <input className="form-control" type="number" min="0"
                  step={form.repasse_type === 'percent' ? '0.5' : '0.01'}
                  max={form.repasse_type === 'percent' ? '100' : undefined}
                  placeholder={form.repasse_type === 'percent' ? 'Ex: 70' : 'Ex: 150.00'}
                  style={{ maxWidth: 130 }}
                  value={form.repasse_value}
                  onChange={e => setForm(f => ({ ...f, repasse_value: e.target.value }))} />
                {form.repasse_value && form.repasse_type === 'percent' && total > 0 && (
                  <span style={{ fontSize: 12, color: 'var(--gray-400)' }}>
                    = R$ {(total * parseFloat(form.repasse_value || 0) / 100).toFixed(2)} desta consulta
                  </span>
                )}
                {form.repasse_value && form.repasse_type === 'fixed' && (
                  <span style={{ fontSize: 12, color: 'var(--gray-400)' }}>fixo por consulta</span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
