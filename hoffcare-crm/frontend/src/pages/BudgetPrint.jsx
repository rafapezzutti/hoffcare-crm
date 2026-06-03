import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import api from '../services/api';
import dayjs from 'dayjs';

const STATUS_LABELS = {
  rascunho:   'Rascunho',
  enviado:    'Enviado',
  aguardando: 'Aguardando Aprovação',
  aceito:     'Aceito',
  declinado:  'Declinado',
  expirado:   'Expirado',
};

export default function BudgetPrint() {
  const { id } = useParams();
  const [budget, setBudget] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get(`/budgets/${id}`)
      .then(res => setBudget(res.data))
      .catch(() => setError('Erro ao carregar orçamento.'))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontFamily: 'Inter, sans-serif' }}>
        <div style={{ textAlign: 'center', color: '#888' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
          <p>Carregando orçamento...</p>
        </div>
      </div>
    );
  }

  if (error || !budget) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontFamily: 'Inter, sans-serif' }}>
        <div style={{ textAlign: 'center', color: '#dc3545' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>⚠️</div>
          <p>{error || 'Orçamento não encontrado.'}</p>
        </div>
      </div>
    );
  }

  const number = budget.number || `ORC-${String(budget.id).padStart(6, '0')}`;
  const total = (budget.items || []).reduce(
    (s, i) => s + (parseFloat(i.qty || 1) * parseFloat(i.unit_value || 0)), 0
  );

  const fmtDate = (d) => d ? dayjs(d).format('DD/MM/YYYY') : '—';
  const fmtMoney = (v) => parseFloat(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  return (
    <>
      {/* Print styles injected via style tag */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
          .print-page { box-shadow: none !important; margin: 0 !important; max-width: 100% !important; }
        }
        body { background: #f0f0f0; margin: 0; padding: 20px; font-family: 'Inter', Arial, sans-serif; font-size: 14px; }
        @page { size: A4; margin: 20mm; }
      `}</style>

      {/* Action bar - not printed */}
      <div className="no-print" style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        background: '#1a2a3a', color: 'white',
        padding: '10px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ fontSize: 14, fontWeight: 600 }}>
          Pré-visualização — Orçamento #{number}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => window.close()}
            style={{
              padding: '6px 16px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.3)',
              background: 'transparent', color: 'white', cursor: 'pointer', fontSize: 13,
            }}
          >
            Fechar
          </button>
          <button
            onClick={() => window.print()}
            style={{
              padding: '6px 20px', borderRadius: 6, border: 'none',
              background: '#E8841A', color: 'white', cursor: 'pointer',
              fontWeight: 700, fontSize: 13,
            }}
          >
            🖨️ Imprimir
          </button>
        </div>
      </div>

      {/* Print page */}
      <div className="print-page" style={{
        background: 'white',
        maxWidth: 794,
        margin: '60px auto 0',
        padding: '40px 50px',
        boxShadow: '0 4px 24px rgba(0,0,0,0.15)',
        minHeight: 1123,
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32, borderBottom: '2px solid #E8841A', paddingBottom: 20 }}>
          <div>
            {/* Logo placeholder */}
            <div style={{
              width: 160, height: 50, background: 'linear-gradient(135deg, #1a2a3a, #2a4a6a)',
              borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'white', fontWeight: 800, fontSize: 18, letterSpacing: 1,
              marginBottom: 6,
            }}>
              HoffCare
            </div>
            <div style={{ fontSize: 11, color: '#888' }}>CRM Saúde</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 24, fontWeight: 800, color: '#1a2a3a', letterSpacing: 1 }}>
              ORÇAMENTO
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#E8841A', marginTop: 2 }}>
              #{number}
            </div>
            <div style={{ marginTop: 8, fontSize: 12 }}>
              <span style={{
                background: budget.status === 'aceito' ? '#e8f5e9' :
                            budget.status === 'declinado' ? '#ffeaea' :
                            budget.status === 'aguardando' ? '#fff8e1' : '#f0f0f0',
                color: budget.status === 'aceito' ? '#2e7d32' :
                       budget.status === 'declinado' ? '#dc3545' :
                       budget.status === 'aguardando' ? '#e65100' : '#555',
                borderRadius: 4, padding: '3px 10px', fontWeight: 700,
              }}>
                {STATUS_LABELS[budget.status] || budget.status}
              </span>
            </div>
          </div>
        </div>

        {/* Info grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 28 }}>
          <div style={{ background: '#f8f9fa', borderRadius: 8, padding: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
              Dados do Paciente
            </div>
            <div style={{ fontWeight: 700, fontSize: 15, color: '#212529', marginBottom: 4 }}>
              {budget.patient_name || '—'}
            </div>
            {budget.patient_cpf && (
              <div style={{ fontSize: 12, color: '#555' }}>CPF: {budget.patient_cpf}</div>
            )}
            {budget.patient_phone && (
              <div style={{ fontSize: 12, color: '#555' }}>Telefone: {budget.patient_phone}</div>
            )}
            {budget.patient_email && (
              <div style={{ fontSize: 12, color: '#555' }}>E-mail: {budget.patient_email}</div>
            )}
          </div>
          <div style={{ background: '#f8f9fa', borderRadius: 8, padding: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
              Informações do Orçamento
            </div>
            <div style={{ fontSize: 13, color: '#555', lineHeight: 2 }}>
              <div><strong>Profissional:</strong> {budget.professional_name || '—'}</div>
              <div><strong>Emissão:</strong> {fmtDate(budget.created_at)}</div>
              <div><strong>Válido até:</strong> {fmtDate(budget.valid_until)}</div>
            </div>
          </div>
        </div>

        {/* Items table */}
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 20 }}>
          <thead>
            <tr style={{ background: '#1a2a3a', color: 'white' }}>
              <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: 12, fontWeight: 600 }}>Procedimento / Serviço</th>
              <th style={{ padding: '10px 14px', textAlign: 'center', fontSize: 12, fontWeight: 600, width: 70 }}>Qtd</th>
              <th style={{ padding: '10px 14px', textAlign: 'right', fontSize: 12, fontWeight: 600, width: 120 }}>Valor Unit.</th>
              <th style={{ padding: '10px 14px', textAlign: 'right', fontSize: 12, fontWeight: 600, width: 120 }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {(budget.items || []).map((item, idx) => {
              const lineTotal = parseFloat(item.qty || 1) * parseFloat(item.unit_value || 0);
              return (
                <tr key={idx} style={{ background: idx % 2 === 0 ? 'white' : '#f8f9fa' }}>
                  <td style={{ padding: '10px 14px', fontSize: 13, borderBottom: '1px solid #eee' }}>
                    {item.procedure_name}
                  </td>
                  <td style={{ padding: '10px 14px', textAlign: 'center', fontSize: 13, borderBottom: '1px solid #eee' }}>
                    {item.qty || 1}
                  </td>
                  <td style={{ padding: '10px 14px', textAlign: 'right', fontSize: 13, borderBottom: '1px solid #eee' }}>
                    {fmtMoney(item.unit_value)}
                  </td>
                  <td style={{ padding: '10px 14px', textAlign: 'right', fontSize: 13, fontWeight: 600, borderBottom: '1px solid #eee' }}>
                    {fmtMoney(lineTotal)}
                  </td>
                </tr>
              );
            })}
            {(!budget.items || budget.items.length === 0) && (
              <tr>
                <td colSpan={4} style={{ padding: '20px', textAlign: 'center', color: '#888', fontSize: 13 }}>
                  Nenhum item neste orçamento.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Total */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 28 }}>
          <div style={{ background: '#1a2a3a', color: 'white', borderRadius: 8, padding: '14px 24px', minWidth: 220, textAlign: 'right' }}>
            <div style={{ fontSize: 12, color: '#aaa', marginBottom: 4 }}>TOTAL DO ORÇAMENTO</div>
            <div style={{ fontSize: 26, fontWeight: 800 }}>{fmtMoney(total)}</div>
          </div>
        </div>

        {/* Notes */}
        {budget.notes && (
          <div style={{ marginBottom: 28, padding: 16, background: '#fffbf0', border: '1px solid #ffe082', borderRadius: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>
              Observações
            </div>
            <div style={{ fontSize: 13, color: '#555', whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>
              {budget.notes}
            </div>
          </div>
        )}

        {/* Footer */}
        <div style={{ borderTop: '1px solid #eee', paddingTop: 16, marginTop: 'auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
            <div style={{ fontSize: 11, color: '#aaa' }}>
              <div>Este orçamento é válido até {fmtDate(budget.valid_until)}.</div>
              <div>Emitido em {fmtDate(budget.created_at)} via HoffCare CRM.</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ borderTop: '1px solid #ccc', paddingTop: 8, marginTop: 24, display: 'inline-block', minWidth: 200 }}>
                <div style={{ fontSize: 11, color: '#888' }}>Assinatura do Responsável</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
