import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../services/api';

export default function AppointmentRespond() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const action = searchParams.get('action');

  const [status, setStatus] = useState('loading'); // loading | success | error
  const [message, setMessage] = useState('');
  const [aptStatus, setAptStatus] = useState('');

  useEffect(() => {
    if (!token || !['confirm', 'cancel'].includes(action)) {
      setStatus('error');
      setMessage('Link inválido. Verifique o e-mail recebido.');
      return;
    }

    api.get(`/appointments/respond?token=${token}&action=${action}`)
      .then(r => {
        setStatus('success');
        setMessage(r.data.message);
        setAptStatus(r.data.status);
      })
      .catch(err => {
        setStatus('error');
        setMessage(err.response?.data?.error || 'Erro ao processar solicitação.');
      });
  }, []);

  const isConfirm = action === 'confirm';
  const isCancelled = aptStatus === 'cancelled';

  const iconColor = status === 'loading' ? '#4DB8E8'
    : status === 'error' ? '#dc3545'
    : isCancelled ? '#dc3545' : '#28a745';

  const icon = status === 'loading' ? 'fa-spinner fa-spin'
    : status === 'error' ? 'fa-triangle-exclamation'
    : isCancelled ? 'fa-calendar-xmark' : 'fa-calendar-check';

  return (
    <div style={{
      minHeight: '100vh', background: '#f0f4f8',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20
    }}>
      <div style={{
        background: 'white', borderRadius: 12, boxShadow: '0 4px 24px rgba(0,0,0,0.1)',
        padding: 48, maxWidth: 440, width: '100%', textAlign: 'center'
      }}>
        {/* Logo */}
        <div style={{ marginBottom: 32 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
            <svg width="40" height="40" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="38" y="10" width="24" height="80" rx="8" fill="#4DB8E8"/>
              <rect x="10" y="38" width="80" height="24" rx="8" fill="#4DB8E8"/>
              <rect x="42" y="14" width="16" height="72" rx="6" fill="#E8841A" opacity="0.7"/>
              <rect x="14" y="42" width="72" height="16" rx="6" fill="#E8841A" opacity="0.7"/>
              <circle cx="50" cy="50" r="10" fill="white"/>
              <circle cx="50" cy="50" r="6" fill="#4DB8E8"/>
            </svg>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#4DB8E8', lineHeight: 1.1 }}>P. Soluções</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#E8841A' }}>para Saúde</div>
            </div>
          </div>
        </div>

        {/* Ícone de status */}
        <div style={{ fontSize: 56, color: iconColor, marginBottom: 20 }}>
          <i className={`fas ${icon}`} />
        </div>

        {/* Mensagem */}
        {status === 'loading' && (
          <p style={{ fontSize: 15, color: '#6c757d' }}>Processando sua solicitação...</p>
        )}
        {status !== 'loading' && (
          <>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: '#1a2535', marginBottom: 12 }}>
              {status === 'error' ? 'Ops!' : isCancelled ? 'Consulta Cancelada' : 'Consulta Confirmada!'}
            </h2>
            <p style={{ fontSize: 14, color: '#495057', lineHeight: 1.6 }}>{message}</p>
          </>
        )}

        <div style={{ marginTop: 32, fontSize: 12, color: '#adb5bd' }}>
          P. Soluções para Saúde · Sistema de Gestão Clínica
        </div>
      </div>
    </div>
  );
}
