import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import './i18n/index.js';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ClinicProvider } from './context/ClinicContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Clinics from './pages/Clinics';
import Professionals from './pages/Professionals';
import Rooms from './pages/Rooms';
import Procedures from './pages/Procedures';
import Patients from './pages/Patients';
import PatientDetail from './pages/PatientDetail';
import CalendarDaily from './pages/CalendarDaily';
import CalendarMonthly from './pages/CalendarMonthly';
import Records from './pages/Records';
import RecordForm from './pages/RecordForm';
import RecordView from './pages/RecordView';
import History from './pages/History';
import Users from './pages/Users';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import AppointmentRespond from './pages/AppointmentRespond';
// Autonomous unificado em Clinics — mantém rota como redirect
import Rentals from './pages/Rentals';
import Settlements from './pages/Settlements';
import ProfessionalStatement from './pages/ProfessionalStatement';
import BankStatement from './pages/BankStatement';
import Permissions from './pages/Permissions';
import MessageCounter from './pages/MessageCounter';
import BeforeAfter from './pages/BeforeAfter';
import Anamnesis from './pages/Anamnesis';
import AnamnesisForm from './pages/AnamnesisForm';
import Anthropometry from './pages/Anthropometry';
import Aesthetics from './pages/Aesthetics';
import AiChat from './pages/AiChat';
import Evolution from './pages/Evolution';
import Odontogram from './pages/Odontogram';
import PatientHistory from './pages/PatientHistory';
import Inventory from './pages/Inventory';
import Budgets from './pages/Budgets';
import BudgetForm from './pages/BudgetForm';
import BudgetPrint from './pages/BudgetPrint';
import Expenses from './pages/Expenses';

function ProtectedRoute({ children, adminOnly }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (adminOnly && user.role !== 'admin') return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  return (
    <AuthProvider>
      <ClinicProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/appointment/respond" element={<AppointmentRespond />} />
          <Route path="/anamnesis/form/:token" element={<AnamnesisForm />} />
          <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route index element={<Dashboard />} />
            <Route path="clinics" element={<ProtectedRoute adminOnly><Clinics /></ProtectedRoute>} />
            <Route path="users" element={<ProtectedRoute><Users /></ProtectedRoute>} />
            <Route path="autonomous" element={<Navigate to="/clinics" replace />} />
            <Route path="professionals" element={<Professionals />} />
            <Route path="rooms" element={<Rooms />} />
            <Route path="procedures" element={<Procedures />} />
            <Route path="patients" element={<Patients />} />
            <Route path="patients/:id" element={<PatientDetail />} />
            <Route path="patients/:id/history"      element={<PatientHistory />} />
            <Route path="patients/:id/evolution"    element={<Evolution />} />
            <Route path="patients/:id/odontogram"  element={<Odontogram />} />
            <Route path="patients/:id/before-after" element={<BeforeAfter />} />
            <Route path="patients/:id/anamnesis" element={<Anamnesis />} />
            <Route path="patients/:id/anthropometry" element={<Anthropometry />} />
            <Route path="calendar/daily" element={<CalendarDaily />} />
            <Route path="calendar/monthly" element={<CalendarMonthly />} />
            <Route path="records" element={<Records />} />
            <Route path="records/new" element={<RecordForm />} />
            <Route path="records/:id/edit" element={<RecordForm />} />
            <Route path="records/:id/view" element={<RecordView />} />
            <Route path="history" element={<History />} />
            <Route path="rentals" element={<Rentals />} />
            <Route path="settlements" element={<Settlements />} />
            <Route path="statement" element={<ProfessionalStatement />} />
            <Route path="bank-statement" element={<BankStatement />} />
            <Route path="permissions" element={<Permissions />} />
            <Route path="ai-chat" element={<AiChat />} />
            <Route path="message-counter" element={<MessageCounter />} />
            <Route path="aesthetics" element={<Aesthetics />} />
            <Route path="inventory" element={<Inventory />} />
            <Route path="budgets" element={<Budgets />} />
            <Route path="budgets/new" element={<BudgetForm />} />
            <Route path="budgets/:id/edit" element={<BudgetForm />} />
            <Route path="expenses" element={<Expenses />} />
          </Route>
          <Route path="/budgets/:id/print" element={<BudgetPrint />} />
        </Routes>
      </BrowserRouter>
      </ClinicProvider>
    </AuthProvider>
  );
}
