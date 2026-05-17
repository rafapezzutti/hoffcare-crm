import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import dayjs from 'dayjs';

export default function RecordView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [record, setRecord] = useState(null);
  const printRef = useRef();

  useEffect(() => {
    api.get(`/records/${id}`).then(r => setRecord(r.data));
  }, [id]);

  const handlePrint = () => window.print();

  const handleSavePDF = () => {
    const pwa = window.open('', '_blank');
    pwa.document.write(`
      <html><head><title>Registro - ${record?.patient_name}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: Arial, sans-serif; font-size: 12px; }
        .doc { width: 210mm; padding: 20mm; margin: 0 auto; }
        h1 { font-size: 18px; color: #4DB8E8; } h2 { font-size: 14px; margin: 12px 0 6px; }
        .header { display: flex; justify-content: space-between; padding-bottom: 12px; border-bottom: 2px solid #E8841A; }
        table { width: 100%; border-collapse: collapse; margin-top: 8px; }
        th { background: #f5f5f5; padding: 6px 10px; text-align: left; font-size: 11px; }
        td { padding: 6px 10px; border-bottom: 1px solid #eee; }
        .total { text-align: right; font-weight: bold; padding: 8px 10px; font-size: 14px; }
        .footer { margin-top: 40px; border-top: 1px solid #eee; padding-top: 16px; font-size: 10px; color: #999; }
      </style></head>
      <body>${printRef.current.innerHTML}</body></html>
    `);
    pwa.document.close();
    pwa.print();
  };

  if (!record) return <div className="loading"><div className="spinner" /></div>;

  const total = record.procedures?.reduce((s, p) => s + Number(p.value), 0) || 0;

  return (
    <div className="page">
      <div className="page-header no-print">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="btn btn-outline btn-sm" onClick={() => navigate('/records')}><i className="fas fa-arrow-left" /></button>
          <h1 className="page-title">Registro de Procedimento</h1>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-outline" onClick={() => navigate(`/records/${id}/edit`)}><i className="fas fa-pen" /> Editar</button>
          <button className="btn btn-secondary" onClick={handleSavePDF}><i className="fas fa-file-pdf" /> Salvar PDF</button>
          <button className="btn btn-primary" onClick={handlePrint}><i className="fas fa-print" /> Imprimir</button>
        </div>
      </div>

      <div className="card" ref={printRef}>
        {/* Header A4 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', paddingBottom: 20, borderBottom: '2px solid var(--orange)', marginBottom: 20 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div>
                <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--blue)', letterSpacing: 2 }}>HOFF</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--orange)', marginTop: -6, letterSpacing: 2 }}>CARE</div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: 'var(--gray-500)', letterSpacing: 2 }}>clínica & odonto</div>
                {record.clinic_name && <div style={{ fontSize: 13, fontWeight: 600, marginTop: 4 }}>{record.clinic_name}</div>}
              </div>
            </div>
            {record.street && <div style={{ fontSize: 11, color: 'var(--gray-500)', marginTop: 6 }}>{record.street}, {record.number} {record.complement} — CEP {record.cep}</div>}
            {record.clinic_phone && <div style={{ fontSize: 11, color: 'var(--gray-500)' }}>Tel: {record.clinic_phone} {record.clinic_email && `| ${record.clinic_email}`}</div>}
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 11, color: 'var(--gray-500)' }}>Nº do Registro</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--gray-800)' }}>#{String(record.id).padStart(6, '0')}</div>
            <div style={{ fontSize: 11, color: 'var(--gray-500)', marginTop: 4 }}>Data: {dayjs(record.consultation_date).format('DD/MM/YYYY')}</div>
          </div>
        </div>

        {/* Patient / Professional */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 20 }}>
          <div>
            <h3 style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--gray-500)', marginBottom: 10 }}>Paciente</h3>
            <PrintRow label="Nome" value={record.patient_name} />
            <PrintRow label="CPF" value={record.patient_cpf} />
            {record.patient_birthdate && <PrintRow label="Nascimento" value={dayjs(record.patient_birthdate).format('DD/MM/YYYY')} />}
          </div>
          <div>
            <h3 style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--gray-500)', marginBottom: 10 }}>Profissional</h3>
            <PrintRow label="Nome" value={record.professional_name} />
            <PrintRow label={record.type === 'medico' ? 'CRM' : 'CRO'} value={record.crm_cro} />
            <PrintRow label="Especialidade" value={record.type === 'medico' ? 'Médico' : 'Dentista'} />
          </div>
        </div>

        {/* Procedures */}
        <h3 style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--gray-500)', marginBottom: 10 }}>Procedimentos Realizados</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: 'var(--gray-50)' }}>
              <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--gray-500)', borderBottom: '2px solid var(--gray-200)' }}>Código</th>
              <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--gray-500)', borderBottom: '2px solid var(--gray-200)' }}>Procedimento</th>
              <th style={{ padding: '10px 14px', textAlign: 'right', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--gray-500)', borderBottom: '2px solid var(--gray-200)' }}>Valor</th>
            </tr>
          </thead>
          <tbody>
            {(record.procedures || []).map((p, i) => (
              <tr key={i} style={{ borderBottom: '1px solid var(--gray-100)' }}>
                <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontSize: 12, color: 'var(--gray-500)' }}>{p.procedure_code}</td>
                <td style={{ padding: '10px 14px' }}>{p.procedure_name}</td>
                <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 500 }}>R$ {Number(p.value).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
          <div style={{ background: 'var(--gray-800)', color: 'white', padding: '14px 24px', borderRadius: 8, display: 'flex', gap: 40, alignItems: 'center' }}>
            <span style={{ fontSize: 13, opacity: 0.8 }}>Total</span>
            <span style={{ fontSize: 22, fontWeight: 700 }}>R$ {total.toFixed(2)}</span>
          </div>
        </div>

        <div style={{ marginTop: 48, paddingTop: 20, borderTop: '1px solid var(--gray-200)', display: 'flex', justifyContent: 'space-between' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ width: 200, borderTop: '1px solid var(--gray-400)', marginTop: 40, paddingTop: 8, fontSize: 11, color: 'var(--gray-500)' }}>
              {record.professional_name}<br />{record.type === 'medico' ? 'CRM' : 'CRO'}: {record.crm_cro}
            </div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ width: 200, borderTop: '1px solid var(--gray-400)', marginTop: 40, paddingTop: 8, fontSize: 11, color: 'var(--gray-500)' }}>
              Assinatura do Paciente<br />{record.patient_name}
            </div>
          </div>
        </div>

        <div style={{ marginTop: 24, textAlign: 'center', fontSize: 10, color: 'var(--gray-400)' }}>
          Documento gerado em {dayjs().format('DD/MM/YYYY HH:mm')} — HoffCare CRM — powered by P. Soluções
        </div>
      </div>

      <style>{`@media print { .no-print { display: none !important; } body { background: white; } .main-content { margin-left: 0 !important; } .sidebar { display: none !important; } }`}</style>
    </div>
  );
}

function PrintRow({ label, value }) {
  return (
    <div style={{ display: 'flex', gap: 8, padding: '4px 0', fontSize: 13 }}>
      <span style={{ color: 'var(--gray-500)', width: 90, flexShrink: 0 }}>{label}:</span>
      <span style={{ fontWeight: 500 }}>{value}</span>
    </div>
  );
}
