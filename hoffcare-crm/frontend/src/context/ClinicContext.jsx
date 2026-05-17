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

  // Carrega lista de clínicas (admin vê todas, responsável vê só a sua)
  useEffect(() => {
    if (!user) return;

    const fetchClinics = async () => {
      try {
        const res = await api.get('/clinics');
        const list = res.data;
        setClinics(list);

        // Se ainda não tem clínica selecionada, usa a do usuário logado
        if (!selectedClinic && list.length > 0) {
          const defaultClinic = list.find(c => c.id === user.clinic_id) || list[0];
          setSelectedClinicState(defaultClinic);
          localStorage.setItem('psaude_clinic', JSON.stringify(defaultClinic));
        }
      } catch (err) {
        console.error('Erro ao carregar clínicas:', err);
      }
    };

    fetchClinics();
  }, [user]);

  const setSelectedClinic = (clinic) => {
    setSelectedClinicState(clinic);
    localStorage.setItem('psaude_clinic', JSON.stringify(clinic));
  };

  return (
    <ClinicContext.Provider value={{ clinics, selectedClinic, setSelectedClinic }}>
      {children}
    </ClinicContext.Provider>
  );
}

export const useClinic = () => useContext(ClinicContext);
