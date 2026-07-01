const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const db = require('./db');
const whatsappRoutes = require('./routes/whatsapp');
const whatsappClient = require('./services/whatsappClient');

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = 'super_secret_key_codec_mvp'; // Em produção usar dotenv

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Rota de Login legada removida. A autenticação agora é feita no Frontend usando Supabase Auth.

// Middleware para verificar token do Supabase
const authenticateToken = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.sendStatus(401);

    try {
        const { data, error } = await db.auth.getUser(token);
        if (error || !data.user) {
            return res.sendStatus(403);
        }

        // Buscar a role do perfil para anexar ao request
        const { data: profile } = await db.from('profiles').select('role').eq('id', data.user.id).single();

        req.user = { 
            id: data.user.id, 
            email: data.user.email,
            role: profile?.role || 'leitor' 
        };
        next();
    } catch (err) {
        console.error('Erro na validação do token Supabase:', err);
        return res.sendStatus(403);
    }
};

// Rotas do WhatsApp (Protegidas)
app.use('/api/whatsapp', authenticateToken, whatsappRoutes);

// Rotas de Focos de Calor / Eventos de Fogo
const focosRoutes = require('./routes/focos');
app.use('/api/focos', focosRoutes);

// Rotas de Administração (Protegidas)
const adminRoutes = require('./routes/admin');
app.use('/api/admin', authenticateToken, adminRoutes);

// Rota protegida de exemplo (Dashboard Antigo - pode ser removida no futuro)
app.get('/api/admin/dashboard', authenticateToken, (req, res) => {
    res.json({ message: 'Bem-vindo à Área Restrita do CODEC', user: req.user });
});
const { initCronJobs } = require('./services/cronJobs');
const { initBroadcastListener } = require('./services/focosBroadcast');

app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
    // Inicializar o cliente do WhatsApp
    whatsappClient.initializeWhatsApp();
    // Inicializar agendador CRON
    initCronJobs();
    // Inicializar ouvinte de Broadcast do Supabase (Sincronização Manual sob demanda)
    initBroadcastListener();
});
