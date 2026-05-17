import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('psaude_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;

  // Envia clínica selecionada para o backend (admin pode trocar de clínica)
  const clinic = localStorage.getItem('psaude_clinic');
  if (clinic) {
    try {
      const parsed = JSON.parse(clinic);
      if (parsed?.id) config.headers['X-Clinic-Id'] = parsed.id;
    } catch {}
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('psaude_token');
      localStorage.removeItem('psaude_user');
      localStorage.removeItem('psaude_clinic');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
