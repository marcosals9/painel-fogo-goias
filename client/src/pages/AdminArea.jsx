import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LogOut } from 'lucide-react';

export default function AdminArea() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchAdminData = async () => {
      const token = localStorage.getItem('codec_token');
      if (!token) {
        navigate('/login');
        return;
      }

      try {
        const response = await axios.get(`${import.meta.env.PROD ? '' : 'http://localhost:3001'}/api/admin/dashboard`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setUser(response.data.user);
      } catch (err) {
        localStorage.removeItem('codec_token');
        navigate('/login');
      } finally {
        setLoading(false);
      }
    };

    fetchAdminData();
  }, [navigate]);

  useEffect(() => {
    // Interceptor global para capturar erros 401 e 403 (Sessão Expirada) em qualquer requisição
    const interceptor = axios.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response && (error.response.status === 401 || error.response.status === 403)) {
          alert('Sua sessão expirou por inatividade. Por favor, faça login novamente.');
          localStorage.removeItem('codec_token');
          navigate('/login');
        }
        return Promise.reject(error);
      }
    );

    return () => {
      axios.interceptors.response.eject(interceptor);
    };
  }, [navigate]);


  if (loading) return <div className="text-center py-10">Carregando painel...</div>;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="mb-8">
        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Painel Administrativo</h2>
        <p className="text-muted-foreground text-sm sm:text-base">Gerenciamento da Sala de Situação</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Bem-vindo, {user?.username}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Este é um MVP. Em versões futuras, aqui estarão os controles de configuração de alertas,
              gerenciamento de equipes operacionais e relatórios gerenciais da Defesa Civil.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
