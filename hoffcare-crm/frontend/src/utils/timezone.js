import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

export { dayjs };

/**
 * Converte uma data/hora em UTC para o timezone da clínica
 * @param {string|Date} date - data em UTC
 * @param {string} tz - timezone (ex: 'America/Sao_Paulo')
 */
export const toClinicTz = (date, tz = 'America/Sao_Paulo') =>
  dayjs(date).tz(tz);

/**
 * Converte datetime-local (string sem offset) interpretada no timezone da clínica para UTC
 * @param {string} localStr - '2026-05-28T14:00'
 * @param {string} tz - timezone da clínica
 */
export const fromClinicTz = (localStr, tz = 'America/Sao_Paulo') =>
  dayjs.tz(localStr, tz).utc().toISOString();

/**
 * Formata data no timezone da clínica
 */
export const formatInTz = (date, tz = 'America/Sao_Paulo', fmt = 'HH:mm') =>
  dayjs(date).tz(tz).format(fmt);

// Lista de timezones comuns para o seletor
export const TIMEZONES = [
  { value: 'America/Sao_Paulo',      label: 'Brasil — São Paulo (BRT -3)' },
  { value: 'America/Manaus',         label: 'Brasil — Manaus (AMT -4)' },
  { value: 'America/Belem',          label: 'Brasil — Belém (BRT -3)' },
  { value: 'America/Fortaleza',      label: 'Brasil — Fortaleza (BRT -3)' },
  { value: 'America/Recife',         label: 'Brasil — Recife (BRT -3)' },
  { value: 'America/Noronha',        label: 'Brasil — Fernando de Noronha (FNT -2)' },
  { value: 'America/Porto_Velho',    label: 'Brasil — Porto Velho (AMT -4)' },
  { value: 'America/Boa_Vista',      label: 'Brasil — Boa Vista (AMT -4)' },
  { value: 'America/Rio_Branco',     label: 'Brasil — Rio Branco (ACT -5)' },
  { value: 'America/New_York',       label: 'EUA — Nova York (ET -5/-4)' },
  { value: 'America/Chicago',        label: 'EUA — Chicago (CT -6/-5)' },
  { value: 'America/Denver',         label: 'EUA — Denver (MT -7/-6)' },
  { value: 'America/Los_Angeles',    label: 'EUA — Los Angeles (PT -8/-7)' },
  { value: 'America/Anchorage',      label: 'EUA — Anchorage (AKT -9/-8)' },
  { value: 'America/Buenos_Aires',   label: 'Argentina — Buenos Aires (ART -3)' },
  { value: 'America/Santiago',       label: 'Chile — Santiago (CLT -4/-3)' },
  { value: 'America/Lima',           label: 'Peru — Lima (PET -5)' },
  { value: 'America/Bogota',         label: 'Colômbia — Bogotá (COT -5)' },
  { value: 'America/Caracas',        label: 'Venezuela — Caracas (VET -4)' },
  { value: 'America/Mexico_City',    label: 'México — Cidade do México (CST -6/-5)' },
  { value: 'America/Toronto',        label: 'Canadá — Toronto (ET -5/-4)' },
  { value: 'America/Vancouver',      label: 'Canadá — Vancouver (PT -8/-7)' },
  { value: 'Europe/Lisbon',          label: 'Portugal — Lisboa (WET 0/+1)' },
  { value: 'Europe/London',          label: 'Reino Unido — Londres (GMT 0/+1)' },
  { value: 'Europe/Madrid',          label: 'Espanha — Madrid (CET +1/+2)' },
  { value: 'Europe/Paris',           label: 'França — Paris (CET +1/+2)' },
  { value: 'Europe/Berlin',          label: 'Alemanha — Berlim (CET +1/+2)' },
  { value: 'Europe/Rome',            label: 'Itália — Roma (CET +1/+2)' },
  { value: 'Europe/Amsterdam',       label: 'Holanda — Amsterdã (CET +1/+2)' },
  { value: 'Europe/Zurich',          label: 'Suíça — Zurique (CET +1/+2)' },
  { value: 'Europe/Moscow',          label: 'Rússia — Moscou (MSK +3)' },
  { value: 'Africa/Luanda',          label: 'Angola — Luanda (WAT +1)' },
  { value: 'Africa/Maputo',          label: 'Moçambique — Maputo (CAT +2)' },
  { value: 'Africa/Lagos',           label: 'Nigéria — Lagos (WAT +1)' },
  { value: 'Asia/Dubai',             label: 'Emirados — Dubai (GST +4)' },
  { value: 'Asia/Tokyo',             label: 'Japão — Tóquio (JST +9)' },
  { value: 'Asia/Shanghai',          label: 'China — Xangai (CST +8)' },
  { value: 'Asia/Singapore',         label: 'Singapura (SGT +8)' },
  { value: 'Asia/Kolkata',           label: 'Índia — Mumbai (IST +5:30)' },
  { value: 'Australia/Sydney',       label: 'Austrália — Sydney (AEDT +11/+10)' },
  { value: 'Pacific/Auckland',       label: 'Nova Zelândia — Auckland (NZST +12/+13)' },
  { value: 'UTC',                    label: 'UTC (Coordinated Universal Time)' },
];
