import { Navigate } from 'react-router-dom';
import { useAuth } from './AuthProvider';

export default function ProtectedRoute({ children, requiredRole }) {
  const { user, role, loading } = useAuth();

  if (loading) {
    return <div className="min-h-[50vh] flex items-center justify-center text-slate-500">Carregando permissões...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (requiredRole && role !== requiredRole) {
    // Se o usuário não tem a permissão necessária, redirecionar para a Home ou uma tela de acesso negado
    return <Navigate to="/" replace />;
  }

  return children;
}
