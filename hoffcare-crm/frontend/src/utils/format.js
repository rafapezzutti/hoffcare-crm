/**
 * Formata telefone no padrão (DDD) Número
 * Aceita qualquer formato de entrada e normaliza
 */
export function formatPhone(value) {
  if (!value) return '—';
  const digits = String(value).replace(/\D/g, '');
  if (digits.length === 0) return '—';

  // Remove DDI 55 se presente
  const local = digits.startsWith('55') && digits.length > 11
    ? digits.slice(2)
    : digits;

  if (local.length === 11) {
    // Celular com DDD: (XX) 9XXXX-XXXX
    return `(${local.slice(0,2)}) ${local.slice(2,7)}-${local.slice(7)}`;
  }
  if (local.length === 10) {
    // Fixo com DDD: (XX) XXXX-XXXX
    return `(${local.slice(0,2)}) ${local.slice(2,6)}-${local.slice(6)}`;
  }
  if (local.length === 9) {
    // Celular sem DDD
    return `${local.slice(0,5)}-${local.slice(5)}`;
  }
  if (local.length === 8) {
    // Fixo sem DDD
    return `${local.slice(0,4)}-${local.slice(4)}`;
  }
  // Retorna como veio se não encaixa
  return value;
}

/**
 * Formata CPF no padrão 000.000.000-00
 */
export function formatCPF(value) {
  if (!value) return '—';
  const digits = String(value).replace(/\D/g, '');
  if (digits.length !== 11) return value;
  return `${digits.slice(0,3)}.${digits.slice(3,6)}.${digits.slice(6,9)}-${digits.slice(9)}`;
}

/**
 * Formata CNPJ no padrão 00.000.000/0000-00
 */
export function formatCNPJ(value) {
  if (!value) return '—';
  const digits = String(value).replace(/\D/g, '');
  if (digits.length !== 14) return value;
  return `${digits.slice(0,2)}.${digits.slice(2,5)}.${digits.slice(5,8)}/${digits.slice(8,12)}-${digits.slice(12)}`;
}

/**
 * Formata CPF ou CNPJ automaticamente pela quantidade de dígitos
 */
export function formatDoc(value) {
  if (!value) return '—';
  const digits = String(value).replace(/\D/g, '');
  if (digits.length === 11) return formatCPF(digits);
  if (digits.length === 14) return formatCNPJ(digits);
  return value;
}
