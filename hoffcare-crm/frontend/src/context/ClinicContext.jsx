import { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';
import { useAuth } from './AuthContext';

const ClinicContext = createContext(null);

export function ClinicProvider({ children }) {
  const { user } = useAuth();
  const [clinics, setClinics] = useState([]);
  const [selectedClinic, setSelectedClinicState] = useState(() => {
    const stored = localStorage.getItem('psaude_clinic');
    return stored ? JSON.parse(stored) : null;
  });

  useEffect(() => {
    if (!user) return;

    const fetchClinics = async () => {
      try {
        const res = await api.get('/clinics');
        const list = res.data;
        setClinics(list);

        if (user.role !== 'admin') {
          // Não-admin: seleciona automaticamente a clínica do usuário
          const userClinic = list.find(c => c.id === user.clinic_id) || list[0];
          if (userClinic) {
            setSelectedClinicState(userClinic);
            localStorage.setItem('psaude_clinic', JSON.stringify(userClinic));
          }
        }
        // Admin: não auto-seleciona — fica null até escolher
      } catch (err) {
        console.error('Erro ao carregar clínicas:', err);
      }
    };

    fetchClinics();
  }, [user]);

  const setSelectedClinic = (clinic) => {
    setSelectedClinicState(clinic);
    if (clinic) {
      localStorage.setItem('psaude_clinic', JSON.stringify(clinic));
    } else {
      localStorage.removeItem('psaude_clinic');
    }
  };

  // Limpa clínica selecionada ao trocar de usuário
  useEffect(() => {
    if (!user) {
      setSelectedClinicState(null);
      localStorage.removeItem('psaude_clinic');
    }
  }, [user]);

  return (
    <ClinicContext.Provider value={{ clinics, selectedClinic, setSelectedClinic }}>
      {children}
    </ClinicContext.Provider>
  );
}

export const useClinic = () => useContext(ClinicContext);
