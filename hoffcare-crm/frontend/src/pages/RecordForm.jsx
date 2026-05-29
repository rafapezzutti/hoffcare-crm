import { useState, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../services/api';
import dayjs from 'dayjs';
import { PROF_TYPES, getProfType } from '../config/professionalTypes';
import { useAuth } from '../context/AuthContext';

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
  });

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
          procedures: rec.procedures || []
        });
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
    if (!form.patient_id || !form.professional_id) {
      setError(t('recordForm.errorRequired')); return;
    }
    // Valida procedimentos manuais: precisam ter nome
    const emptyManual = form.procedures.find(p => p.isManual && !p.procedure_name.trim());
    if (emptyManual) { setError(t('recordForm.errorManual')); return; }

    setSaving(true); setError('');
    try {
      if (isEdit) await api.put(`/records/${id}`, form);
      else { const r = await api.post('/records', form); navigate(`/records/${r.data.id}/view`); return; }
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
          <div className="form-group" style={{ position: 'relative' }}>
            <label className="form-label">{t('recordForm.patient')} <span className="required">*</span></label>
            <input className="form-control" placeholder={t('recordForm.searchPatient')} value={patientSearch}
              onChange={e => { setPatientSearch(e.target.value); setForm(f => ({ ...f, patient_id: '' })); setSelectedPatient(null); }} />
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
