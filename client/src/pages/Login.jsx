import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Shield } from 'lucide-react';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');

    try {
      const response = await axios.post('http://localhost:3001/api/auth/login', {
        username,
        password
      });
      
      localStorage.setItem('codec_token', response.data.token);
      navigate('/admin');
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao conectar ao servidor');
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
              <Label htmlFor="username">Usuário</Label>
              <Input 
                id="username" 
                type="text" 
                placeholder="admin"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
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
          <CardFooter className="flex gap-4 pt-2">
            <Button type="button" variant="ghost" className="flex-1 text-muted-foreground hover:text-foreground" onClick={() => navigate('/')}>Cancelar</Button>
            <Button type="submit" className="flex-1 bg-[#002b5e] hover:bg-[#001a38] text-white">Entrar</Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
