import { BrowserRouter as Router, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { Lock, User, LogOut, ChevronDown } from 'lucide-react';
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import AdminArea from './pages/AdminArea';
import { useAutoLogout } from './hooks/useAutoLogout';
import TimeoutModal from './components/TimeoutModal';

function AppContent() {
  const [theme, setTheme] = useState('theme-cerrado-vivo');
  const [menuOpen, setMenuOpen] = useState(false);
  const [showTimeoutModal, setShowTimeoutModal] = useState(false);
  const isLoggedIn = !!localStorage.getItem('codec_token');
  const location = useLocation();

  const handleLogout = () => {
    localStorage.removeItem('codec_token');
    window.location.href = '/login';
  };

  const handleSessionTimeout = useCallback(() => {
    localStorage.removeItem('codec_token');
    setShowTimeoutModal(true);
  }, []);

  const closeTimeoutModal = () => {
    setShowTimeoutModal(false);
    window.location.href = '/login';
  };

  useAutoLogout(isLoggedIn, 30, handleSessionTimeout);

  useEffect(() => {
    // Interceptor global para capturar erros 401 e 403 (Sessão Expirada) em qualquer requisição
    const interceptor = axios.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response && (error.response.status === 401 || error.response.status === 403)) {
          handleSessionTimeout();
        }
        return Promise.reject(error);
      }
    );

    return () => {
      axios.interceptors.response.eject(interceptor);
    };
  }, [handleSessionTimeout]);

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
    // Aplica a classe de tema no root document body
    document.body.className = theme;
  }, [theme]);

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
                      title="Menu do Administrador"
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
                            <Link to="/admin" className="block px-4 py-3 text-sm font-medium hover:bg-slate-100 border-b" onClick={() => setMenuOpen(false)}>
                              Painel Administrativo
                            </Link>
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
          <Route path="/admin" element={<AdminArea />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </main>

      <TimeoutModal isOpen={showTimeoutModal} onClose={closeTimeoutModal} />
    </div>
  );
}

function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}

export default App;
