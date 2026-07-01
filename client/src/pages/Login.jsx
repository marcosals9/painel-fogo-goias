import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/AuthProvider';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Shield } from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [localLoading, setLocalLoading] = useState(false);
  const navigate = useNavigate();
  const { user, role, forceReloadSession } = useAuth();

  useEffect(() => {
    if (user && role) {
      if (role === 'admin') {
        navigate('/admin', { replace: true });
      } else {
        navigate('/', { replace: true });
      }
    }
  }, [user, role, navigate]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLocalLoading(true);

    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (signInError) throw signInError;
      
      if (forceReloadSession) {
        await forceReloadSession();
      }
      
      setLocalLoading(false);
    } catch (err) {
      console.error('Erro de login:', err);
      setError(err.message === 'Invalid login credentials' ? 'Credenciais inválidas' : 'Erro ao conectar. Tente novamente.');
      setLocalLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-[80vh] px-4">
      <Card className="w-full max-w-md shadow-xl border-t-4 border-t-primary">
        <CardHeader className="space-y-1 items-center">
          <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-2">
            <Shield className="w-6 h-6 text-primary" />
          </div>
          <CardTitle className="text-2xl font-bold">Área Restrita</CardTitle>
          <CardDescription>
            Insira suas credenciais para acessar o painel administrativo.
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleLogin}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input 
                id="email" 
                type="email" 
                placeholder="admin@defesacivil.go.gov.br"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input 
                id="password" 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            {error && (
              <div className="text-sm text-destructive font-medium bg-destructive/10 p-2 rounded">
                {error}
              </div>
            )}
          </CardContent>
          <CardFooter className="flex gap-3 pt-2">
            <Button type="button" size="sm" className="flex-1 bg-[#ff7f00] hover:bg-[#cc6600] text-white" onClick={() => navigate('/')} disabled={localLoading}>Cancelar</Button>
            <Button type="submit" size="sm" className="flex-1 bg-[#002b5e] hover:bg-[#001a38] text-white" disabled={localLoading}>
              {localLoading ? 'Verificando acessos...' : 'Entrar'}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
