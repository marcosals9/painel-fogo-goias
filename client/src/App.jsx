import { BrowserRouter as Router, Routes, Route, Navigate, Link, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { Lock, User, LogOut } from 'lucide-react';
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import AdminArea from './pages/AdminArea';
import MaintenanceOverlay from './pages/MaintenanceOverlay';
import { AuthProvider, useAuth } from './components/AuthProvider';
import ProtectedRoute from './components/ProtectedRoute';
import { supabase } from './lib/supabase';

function AppContent() {
  const [theme, setTheme] = useState('theme-cerrado-vivo');
  const [menuOpen, setMenuOpen] = useState(false);
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const { session, role, signOut, loading: authLoading } = useAuth();
  const isLoggedIn = !!session;
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = async () => {
    setMenuOpen(false);
    await signOut();
    navigate('/');
  };

  useEffect(() => {
    // Buscar status inicial do modo manutenção
    const fetchMaintenanceStatus = async () => {
      const { data, error } = await supabase
        .from('system_settings')
        .select('maintenance_mode')
        .eq('id', '00000000-0000-0000-0000-000000000001')
        .single();
      
      if (!error && data) {
        setMaintenanceMode(data.maintenance_mode);
      }
    };

    fetchMaintenanceStatus();

    // Ouvir alterações em tempo real no modo manutenção
    const channel = supabase.channel('public:system_settings')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'system_settings' },
        (payload) => {
          setMaintenanceMode(payload.new.maintenance_mode);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    // Determinar a operação baseada no mês atual (0-11)
    const currentMonth = new Date().getMonth();
    // Cerrado Vivo (Estiagem): Maio (4) a Outubro (9)
    if (currentMonth >= 4 && currentMonth <= 9) {
      setTheme('theme-cerrado-vivo');
    } else {
      setTheme('theme-tempestade');
    }
  }, []);

  useEffect(() => {
    document.body.className = theme;
  }, [theme]);

  // Se modo manutenção ativo e usuário não é admin, bloqueia o app inteiro
  // Apenas se a autenticação já tiver terminado de carregar (para não bloquear admin)
  if (maintenanceMode && !authLoading && role !== 'admin' && location.pathname !== '/login') {
    return <MaintenanceOverlay />;
  }

  // O ProtectedRoute já cuida de barrar as rotas privadas durante o loading.
  // Evitamos dar return no authLoading aqui para não desmontar o <Routes> (isso quebrava a animação de login).

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="border-b-2 border-primary bg-slate-900 sticky top-0 z-50 text-slate-100 shadow-md">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between relative">
          <Link to="/" className="flex items-center gap-3 min-w-0 hover:opacity-80 transition-opacity" title="Sala de Situação Comando de Operações de Defesa Civil - Goiás">
            <div className="w-11 h-11 sm:w-12 sm:h-12 flex items-center justify-center rounded-full overflow-hidden shrink-0">
              <img src="/defesa-civil.png" alt="Defesa Civil" className="w-full h-full object-contain" />
            </div>
            <h1 className="text-sm sm:text-base font-medium text-orange-400 tracking-wide truncate flex items-baseline">
              Sala de Situação <span className="text-lg sm:text-xl font-bold text-white ml-1.5 tracking-tight">CODEC</span>
            </h1>
          </Link>
          <div className="text-sm font-semibold text-slate-200 flex items-center gap-3 tracking-wide shrink-0">
            {theme === 'theme-cerrado-vivo' ? (
              <div className="relative">
                {isLoggedIn ? (
                  <div>
                    <button
                      onClick={() => setMenuOpen(!menuOpen)}
                      className="flex items-center justify-center hover:opacity-80 transition-opacity bg-slate-800 w-10 h-10 rounded-full border border-slate-700 focus:outline-none"
                      title="Menu do Usuário"
                    >
                      <User className="w-5 h-5 text-orange-400" />
                    </button>

                    {menuOpen && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)}></div>
                        <div className="absolute right-0 mt-2 w-48 bg-white text-slate-800 rounded-md shadow-lg overflow-hidden border z-50">
                          {location.pathname === '/admin' ? (
                            <Link to="/" className="block px-4 py-3 text-sm font-medium hover:bg-slate-100 border-b" onClick={() => setMenuOpen(false)}>
                              Voltar para o Mapa
                            </Link>
                          ) : (
                            role === 'admin' && (
                              <Link to="/admin" className="block px-4 py-3 text-sm font-medium hover:bg-slate-100 border-b" onClick={() => setMenuOpen(false)}>
                                Painel Administrativo
                              </Link>
                            )
                          )}
                          <button onClick={handleLogout} className="w-full text-left px-4 py-3 text-sm font-medium text-red-600 hover:bg-red-50 flex items-center gap-2">
                            <LogOut className="w-4 h-4" /> Sair
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ) : (
                  <Link to="/login" className="flex items-center justify-center hover:opacity-80 transition-opacity bg-slate-800 w-10 h-10 rounded-full border border-slate-700" title="Área Restrita">
                    <Lock className="w-5 h-5 text-orange-400" />
                  </Link>
                )}
              </div>
            ) : '🌧️ Tempestade'}
          </div>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-4 py-8">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/login" element={<Login />} />
          <Route 
            path="/admin" 
            element={
              <ProtectedRoute requiredRole="admin">
                <AdminArea />
              </ProtectedRoute>
            } 
          />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </main>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <AppContent />
      </Router>
    </AuthProvider>
  );
}

export default App;
