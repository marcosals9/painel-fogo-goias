const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
const db = require('../db'); // Client normal (anon)

// Instância do Supabase com Service Role (necessária para bypassar Auth/RLS e gerenciar usuários)
// Nota: Certifique-se de adicionar SUPABASE_SERVICE_ROLE_KEY no seu .env
const supabaseAdmin = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY // Fallback temporário
);

// Rota para convidar usuário
router.post('/invite', async (req, res) => {
    const { email, role } = req.body;
    
    // req.user é preenchido pelo middleware authenticateToken
    if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Acesso negado. Apenas administradores podem convidar usuários.' });
    }

    if (!email) {
        return res.status(400).json({ error: 'O e-mail é obrigatório.' });
    }

    try {
        // 1. Convidar usuário via Auth Admin
        const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email);
        
        if (inviteError) {
            console.error('Erro ao convidar usuário (Supabase Auth):', inviteError);
            return res.status(500).json({ error: 'Erro ao enviar convite.', details: inviteError.message });
        }

        const newUserId = inviteData.user.id;

        // 2. Atualizar a Role na tabela profiles (O trigger cuidou do insert inicial)
        // Precisamos esperar um pouco para garantir que o trigger já inseriu na tabela profiles
        await new Promise(resolve => setTimeout(resolve, 500));
        
        const { error: profileError } = await supabaseAdmin
            .from('profiles')
            .update({ role: role || 'leitor' })
            .eq('id', newUserId);

        if (profileError) {
            console.error('Erro ao atualizar role do novo usuário:', profileError);
            // Continua, pois o usuário já foi convidado (ficará como leitor por padrão)
        }

        // 3. Registrar auditoria
        await supabaseAdmin.from('audit_logs').insert({
            user_id: req.user.id,
            action: 'invite_user',
            details: { invited_email: email, assigned_role: role || 'leitor' }
        });

        res.json({ message: 'Convite enviado com sucesso.', user: inviteData.user });
    } catch (error) {
        console.error('Erro no endpoint de convite:', error);
        res.status(500).json({ error: 'Erro interno do servidor.' });
    }
});

// A alteração de role de usuários existentes e configurações do sistema (CRON, Manutenção)
// pode ser feita DIRETAMENTE pelo Frontend, já que temos as políticas RLS permitindo isso
// para quem tem role = 'admin'. Mas se o frontend preferir usar o backend, poderíamos expor aqui.

module.exports = router;
