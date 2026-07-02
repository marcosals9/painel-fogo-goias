import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/AuthProvider';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Users, Settings, LayoutDashboard, RefreshCw, AlertTriangle, 
  CheckCircle, Clock, ShieldAlert, Send
} from 'lucide-react';
import axios from 'axios';

export default function AdminArea() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [loading, setLoading] = useState(true);
  
  // States para Sistema
  const [settings, setSettings] = useState(null);
  const [savingSettings, setSavingSettings] = useState(false);

  // States para Usuários
  const [profiles, setProfiles] = useState([]);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('leitor');
  const [inviting, setInviting] = useState(false);

  // States para Sync Manual
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Busca Configurações
      const { data: sysData } = await supabase.from('system_settings').select('*').single();
      setSettings(sysData);

      // Busca Usuários (perfis)
      const { data: profData } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
      setProfiles(profData || []);
    } catch (err) {
      console.error('Erro ao buscar dados do Admin:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateSetting = async (key, value) => {
    setSavingSettings(true);
    try {
      await supabase.from('system_settings').update({ [key]: value }).eq('id', '00000000-0000-0000-0000-000000000001');
      setSettings(prev => ({ ...prev, [key]: value }));
      
      // Registrar log (em uma aplicação real o backend poderia fazer isso via trigger para maior segurança, 
      // mas vamos registrar aqui pelo frontend para simplificar, já que temos acesso)
      await supabase.from('audit_logs').insert({
        user_id: user.id,
        action: `update_${key}`,
        details: { new_value: value }
      });
    } catch (err) {
      console.error('Erro ao atualizar configuração:', err);
      alert('Erro ao atualizar configuração');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleUpdateUserRole = async (profileId, newRole) => {
    try {
      await supabase.from('profiles').update({ role: newRole }).eq('id', profileId);
      setProfiles(prev => prev.map(p => p.id === profileId ? { ...p, role: newRole } : p));
      
      await supabase.from('audit_logs').insert({
        user_id: user.id,
        action: 'update_role',
        details: { target_profile_id: profileId, new_role: newRole }
      });
    } catch (err) {
      console.error('Erro ao atualizar role:', err);
    }
  };

  const handleInviteUser = async (e) => {
    e.preventDefault();
    if (!inviteEmail) return;
    
    setInviting(true);
    try {
      // Precisamos chamar o backend (Node) pois convite usa Service Role
      const { data: sessionData } = await supabase.auth.getSession();
      await axios.post(`${import.meta.env.PROD ? '' : 'http://localhost:3001'}/api/admin/invite`, 
        { email: inviteEmail, role: inviteRole },
        { headers: { Authorization: `Bearer ${sessionData.session.access_token}` } }
      );
      
      alert('Convite enviado com sucesso!');
      setInviteEmail('');
      fetchData(); // Recarrega lista
    } catch (err) {
      console.error('Erro ao convidar:', err);
      alert('Erro ao convidar usuário. Verifique se o backend está rodando e a service key configurada.');
    } finally {
      setInviting(false);
    }
  };

  const handleManualSync = async () => {
    setSyncing(true);
    try {
      const today = new Date();
      today.setUTCHours(today.getUTCHours() - 3);
      const dateStr = today.toISOString().split('T')[0];

      await axios.post(`${import.meta.env.PROD ? '' : 'http://localhost:3001'}/api/focos/sync`, { date: dateStr, tz: 'BRT' });
      alert('Sincronização iniciada com sucesso.');
      fetchData();
    } catch (err) {
      console.error('Erro no sync manual:', err);
      alert('Erro na sincronização manual.');
    } finally {
      setSyncing(false);
    }
  };

  if (loading) return <div className="min-h-[50vh] flex items-center justify-center text-slate-400">Carregando painel de controle...</div>;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-6xl mx-auto">
      {/* Header Premium */}
      <div className="flex flex-col md:flex-row md:items-center justify-between bg-card p-6 rounded-2xl border border-border shadow-sm">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-card-foreground flex items-center gap-3">
            <ShieldAlert className="w-8 h-8 text-amber-500" />
            Centro de Comando
          </h2>
          <p className="text-muted-foreground mt-1">Gestão de acessos, automações e status do sistema CODEC.</p>
        </div>
        <div className="mt-4 md:mt-0 flex bg-muted p-1 rounded-xl border border-border">
          <button 
            onClick={() => setActiveTab('dashboard')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'dashboard' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
          >
            <LayoutDashboard className="w-4 h-4 inline-block mr-2" /> Visão Geral
          </button>
          <button 
            onClick={() => setActiveTab('users')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'users' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
          >
            <Users className="w-4 h-4 inline-block mr-2" /> Acessos
          </button>
          <button 
            onClick={() => setActiveTab('system')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'system' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
          >
            <Settings className="w-4 h-4 inline-block mr-2" /> Sistema
          </button>
        </div>
      </div>

      {/* Aba Dashboard */}
      {activeTab === 'dashboard' && (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <Card className="hover:border-primary/50 transition-colors">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-medium flex items-center gap-2">
                <RefreshCw className="w-5 h-5 text-blue-500" />
                Status CENSIPAM
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3 mb-4">
                {settings?.last_sync_status === 'success' ? (
                  <CheckCircle className="w-10 h-10 text-emerald-500" />
                ) : settings?.last_sync_status === 'error' ? (
                  <AlertTriangle className="w-10 h-10 text-red-500" />
                ) : (
                  <Clock className="w-10 h-10 text-muted-foreground" />
                )}
                <div>
                  <p className="text-2xl font-bold uppercase">
                    {settings?.last_sync_status || 'DESCONHECIDO'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Última att: {settings?.last_sync_time ? new Date(settings.last_sync_time).toLocaleString() : 'N/A'}
                  </p>
                </div>
              </div>
              <Button 
                onClick={handleManualSync} 
                disabled={syncing}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white border-none"
                variant="outline"
              >
                {syncing ? 'Sincronizando...' : 'Forçar Sincronização Agora'}
              </Button>
            </CardContent>
          </Card>

          <Card className="hover:border-primary/50 transition-colors">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-medium flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-amber-500" />
                Modo Manutenção
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-4">
                <p className="text-sm text-muted-foreground">
                  Bloqueia o acesso público ao mapa. Apenas administradores poderão visualizar o sistema.
                </p>
                <div className="flex items-center justify-between bg-muted p-3 rounded-lg border border-border">
                  <span className="font-medium text-foreground">Status Atual:</span>
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${settings?.maintenance_mode ? 'bg-red-500/20 text-red-600 dark:text-red-400' : 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'}`}>
                    {settings?.maintenance_mode ? 'ATIVADO' : 'DESATIVADO'}
                  </span>
                </div>
                <Button 
                  onClick={() => handleUpdateSetting('maintenance_mode', !settings?.maintenance_mode)}
                  disabled={savingSettings}
                  className={`w-full ${settings?.maintenance_mode ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'} text-white border-none`}
                >
                  {settings?.maintenance_mode ? 'Desativar Manutenção' : 'Ativar Modo Manutenção'}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="hover:border-primary/50 transition-colors lg:col-span-1 md:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-medium flex items-center gap-2">
                <Users className="w-5 h-5 text-purple-500" />
                Resumo de Acessos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between p-4 bg-muted rounded-xl border border-border mb-2">
                <span className="text-muted-foreground">Total de Usuários</span>
                <span className="text-2xl font-bold text-foreground">{profiles.length}</span>
              </div>
              <div className="flex items-center justify-between p-4 bg-muted rounded-xl border border-border">
                <span className="text-muted-foreground">Administradores</span>
                <span className="text-2xl font-bold text-amber-500">
                  {profiles.filter(p => p.role === 'admin').length}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Aba Usuários */}
      {activeTab === 'users' && (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Usuários Registrados</CardTitle>
                <CardDescription>Gerencie os níveis de acesso da equipe.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left text-muted-foreground">
                    <thead className="text-xs uppercase bg-muted/50 border-b border-border">
                      <tr>
                        <th className="px-4 py-3 text-foreground">E-mail</th>
                        <th className="px-4 py-3 text-foreground">Data de Criação</th>
                        <th className="px-4 py-3 text-right text-foreground">Nível de Acesso</th>
                      </tr>
                    </thead>
                    <tbody>
                      {profiles.map(profile => (
                        <tr key={profile.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-4 font-medium text-foreground">{profile.email}</td>
                          <td className="px-4 py-4">{new Date(profile.created_at).toLocaleDateString()}</td>
                          <td className="px-4 py-4 text-right">
                            <select 
                              className="bg-background border border-input text-foreground text-sm rounded-lg focus:ring-primary focus:border-primary p-2 outline-none"
                              value={profile.role}
                              onChange={(e) => handleUpdateUserRole(profile.id, e.target.value)}
                            >
                              <option value="leitor">Leitor</option>
                              <option value="operador">Operador</option>
                              <option value="admin">Administrador</option>
                            </select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
          
          <div>
            <Card className="sticky top-24">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Send className="w-5 h-5 text-amber-500" />
                  Convidar Equipe
                </CardTitle>
                <CardDescription>
                  Envie um Magic Link por e-mail para um novo membro.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleInviteUser} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="inviteEmail">E-mail Institucional</Label>
                    <Input 
                      id="inviteEmail" 
                      type="email" 
                      placeholder="exemplo@goias.gov.br" 
                      className="bg-background"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="inviteRole">Nível de Acesso Inicial</Label>
                    <select 
                      id="inviteRole"
                      className="w-full bg-background border border-input text-foreground text-sm rounded-lg focus:ring-primary focus:border-primary p-2.5 outline-none"
                      value={inviteRole}
                      onChange={(e) => setInviteRole(e.target.value)}
                    >
                      <option value="leitor">Leitor (Apenas visualiza)</option>
                      <option value="operador">Operador (Ações operacionais)</option>
                      <option value="admin">Administrador (Controle Total)</option>
                    </select>
                  </div>
                  <Button 
                    type="submit" 
                    disabled={inviting}
                    className="w-full bg-amber-600 hover:bg-amber-700 text-white border-none mt-2"
                  >
                    {inviting ? 'Enviando...' : 'Enviar Convite'}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Aba Sistema */}
      {activeTab === 'system' && (
        <div className="max-w-2xl">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-indigo-500" />
                Agendador CENSIPAM (CRON)
              </CardTitle>
              <CardDescription>
                Configure a automação de busca de dados do satélite. As alterações aqui refletem instantaneamente no servidor via Supabase Realtime.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between bg-muted p-4 rounded-xl border border-border">
                <div>
                  <h4 className="text-sm font-medium text-foreground">Status do Agendador Automático</h4>
                  <p className="text-xs text-muted-foreground">Se desativado, os dados só atualizarão manualmente.</p>
                </div>
                <Button 
                  onClick={() => handleUpdateSetting('cron_enabled', !settings?.cron_enabled)}
                  disabled={savingSettings}
                  size="sm"
                  className={`${settings?.cron_enabled ? 'bg-red-600 hover:bg-red-700' : 'bg-emerald-600 hover:bg-emerald-700'} text-white border-none`}
                >
                  {settings?.cron_enabled ? 'Pausar CRON' : 'Iniciar CRON'}
                </Button>
              </div>

              <div className="space-y-3 p-4 bg-muted rounded-xl border border-border">
                <Label htmlFor="cronExpression">Expressão CRON Atual</Label>
                <div className="flex gap-2">
                  <Input 
                    id="cronExpression" 
                    value={settings?.cron_expression || ''} 
                    onChange={(e) => setSettings(prev => ({...prev, cron_expression: e.target.value}))}
                    className="bg-background font-mono text-sm border-input text-foreground focus-visible:ring-primary"
                  />
                  <Button 
                    onClick={() => handleUpdateSetting('cron_expression', settings.cron_expression)}
                    disabled={savingSettings}
                    className="bg-amber-600 hover:bg-amber-700 text-white border-none shrink-0"
                  >
                    Salvar Novo Padrão
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Exemplo atual: <code className="bg-background border border-border px-1.5 py-0.5 rounded text-foreground">30 4,10,13,16,19,22 * * *</code> (Aos 30 minutos das horas especificadas)
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
