import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext({});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [session, setSession] = useState(null);
  // Começa como true para evitar renderizar ProtectedRoute antes da hora
  const [loading, setLoading] = useState(true);

  const loadInitialSession = async () => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    setSession(session);
    setUser(session?.user ?? null);
    if (session?.user) {
      await fetchRole(session.user.id);
    } else {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInitialSession();

    // Escuta mudanças na autenticação (login, logout, refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      const currentUser = session?.user ?? null;
      setSession(session);
      setUser(currentUser);
      
      // Só recarrega a tela de loading e a role se o usuário mudou (novo login de fato) 
      // ou se ainda não temos a role dele.
      // Isso evita que eventos espúrios do Supabase (como sync de abas ou token refresh mal classificado) pisquem a tela.
      if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
        if (currentUser) {
          // Usando uma callback no setState para garantir que estamos lendo o valor atual da role/user na memória do React
          setRole((prevRole) => {
            // Se já temos a role desse mesmo usuário, não faz sentido piscar a tela e buscar de novo
            if (prevRole !== null) {
              return prevRole; 
            }
            
            // Senão, é login fresco. Coloca em loading e busca.
            setLoading(true);
            fetchRole(currentUser.id);
            return prevRole; // a promise fetchRole chamará setRole de novo quando acabar
          });
        } else {
          setRole(null);
          setLoading(false);
        }
      } else if (event === 'SIGNED_OUT') {
        setRole(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchRole = async (userId) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .single();
      
      if (!error && data) {
        setRole(data.role);
      } else {
        setRole('leitor'); // default
      }
    } catch (err) {
      console.error('Erro ao buscar role:', err);
      setRole('leitor');
    } finally {
      // Role e User estão preenchidos, então agora as Rotas Protegidas podem ser liberadas.
      setLoading(false);
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ session, user, role, loading, signOut, forceReloadSession: loadInitialSession }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  return useContext(AuthContext);
};
