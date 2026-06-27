import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import AdminArea from './pages/AdminArea';

function App() {
  const [theme, setTheme] = useState('theme-cerrado-vivo');

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
    <Router>
      <div className="min-h-screen bg-background text-foreground flex flex-col">
        <header className="border-b-2 border-primary bg-slate-900 sticky top-0 z-50 text-slate-100 shadow-md">
          <div className="container mx-auto px-4 h-16 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 flex items-center justify-center rounded-full overflow-hidden bg-white shadow-sm p-1 ring-2 ring-slate-900 shrink-0">
                <img src="/defesa-civil.png" alt="Defesa Civil" className="w-full h-full object-contain" />
              </div>
              <h1 className="text-xl font-bold tracking-tight">Sala de Situação CODEC</h1>
            </div>
            <div className="text-sm font-semibold text-slate-200 hidden sm:flex items-center gap-3 tracking-wide">
              {theme === 'theme-cerrado-vivo' ? (
                <>
                  <div className="w-10 h-10 flex items-center justify-center rounded-full bg-white shadow-sm p-1 ring-2 ring-slate-900 shrink-0">
                    <img src="/cbmgo.png" alt="CBMGO" className="w-full h-full object-contain" />
                  </div>
                  Corpo de Bombeiros Militar do Estado de Goiás
                </>
              ) : '🌧️ Operação Tempestade'}
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
      </div>
    </Router>
  );
}

export default App;
