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
        <header className="border-b bg-card/50 backdrop-blur-md sticky top-0 z-50">
          <div className="container mx-auto px-4 h-16 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
                <span className="text-primary-foreground font-bold text-sm">CD</span>
              </div>
              <h1 className="text-xl font-bold tracking-tight">Sala de Situação CODEC</h1>
            </div>
            <div className="text-sm font-medium text-muted-foreground hidden sm:block">
              {theme === 'theme-cerrado-vivo' ? '🔥 Operação Cerrado Vivo' : '🌧️ Operação Tempestade'}
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
