const express = require('express');
const router = express.Router();
const whatsappClient = require('../services/whatsappClient');
const db = require('../db');

// Rota para checar status do WhatsApp (QR Code / Conectado)
router.get('/status', (req, res) => {
    const status = whatsappClient.getStatus();
    res.json(status);
});

// Rota para buscar as conversas (grupos e contatos)
router.get('/chats', async (req, res) => {
    try {
        const chats = await whatsappClient.getChats();
        res.json({ success: true, chats });
    } catch (error) {
        res.status(500).json({ error: 'Erro ao buscar conversas', details: error.message });
    }
});

// Rota para disparar o boletim e salvar no banco de dados
router.post('/send', async (req, res) => {
    let { titulo, texto, imagemBase64, destinatarios, destinatario } = req.body;

    // Suporte para string única ou array
    if (destinatario && (!destinatarios || destinatarios.length === 0)) {
        destinatarios = [destinatario];
    }

    if (!texto || !destinatarios || !Array.isArray(destinatarios) || destinatarios.length === 0) {
        return res.status(400).json({ error: 'Texto e destinatários são obrigatórios.' });
    }

    try {
        for (const dest of destinatarios) {
            await whatsappClient.sendBoletim(dest, texto, imagemBase64);
        }

        const destinatariosStr = destinatarios.join(', ');

        // Salvar no banco de dados (tabela informativos)
        const query = `
            INSERT INTO informativos (titulo, texto_boletim, imagem_base64, destinatario, status_envio)
            VALUES (?, ?, ?, ?, ?)
        `;
        
        db.run(query, [titulo || 'Boletim', texto, imagemBase64 || null, destinatariosStr, 'ENVIADO'], function(err) {
            if (err) {
                console.error('Erro ao salvar informativo no banco:', err);
                return res.status(200).json({ success: true, message: 'Mensagem enviada, mas houve erro ao salvar no banco de dados.' });
            }
            res.json({ success: true, message: 'Mensagens enviadas e salvas com sucesso!', id: this.lastID });
        });

    } catch (error) {
        res.status(500).json({ error: 'Erro ao enviar mensagem via WhatsApp', details: error.message });
    }
});

module.exports = router;
