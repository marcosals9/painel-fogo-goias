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

// Rota de Login (Área Restrita)
app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: 'Usuário e senha são obrigatórios.' });
    }

    db.get('SELECT * FROM users WHERE username = ? AND password = ?', [username, password], (err, user) => {
        if (err) {
            return res.status(500).json({ error: 'Erro no servidor' });
        }
        if (!user) {
            return res.status(401).json({ error: 'Credenciais inválidas' });
        }

        const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '1h' });
        res.json({ token, message: 'Login realizado com sucesso' });
    });
});

// Middleware para verificar token
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token == null) return res.sendStatus(401);

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
};

// Rotas do WhatsApp (Protegidas)
app.use('/api/whatsapp', authenticateToken, whatsappRoutes);

// Rota protegida de exemplo (Admin Dashboard)
app.get('/api/admin/dashboard', authenticateToken, (req, res) => {
    res.json({ message: 'Bem-vindo à Área Restrita do CODEC', user: req.user });
});

app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
    // Inicializar o cliente do WhatsApp
    whatsappClient.initializeWhatsApp();
});
