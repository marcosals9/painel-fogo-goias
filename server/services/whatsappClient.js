const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode');

let client;
let currentQrBase64 = null;
let status = 'DISCONNECTED'; // DISCONNECTED, QR_READY, CONNECTED

const initializeWhatsApp = () => {
    client = new Client({
        authStrategy: new LocalAuth(),
        puppeteer: {
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        }
    });

    client.on('qr', async (qr) => {
        status = 'QR_READY';
        currentQrBase64 = await qrcode.toDataURL(qr);
        console.log('QR Code do WhatsApp recebido, aguardando leitura...');
    });

    client.on('ready', () => {
        status = 'CONNECTED';
        currentQrBase64 = null;
        console.log('Cliente WhatsApp está pronto e conectado!');
    });

    client.on('authenticated', () => {
        console.log('WhatsApp Autenticado com sucesso!');
    });

    client.on('auth_failure', msg => {
        console.error('Falha na autenticação do WhatsApp:', msg);
        status = 'DISCONNECTED';
    });

    client.on('disconnected', (reason) => {
        console.log('WhatsApp desconectado:', reason);
        status = 'DISCONNECTED';
    });

    client.initialize();
};

const getStatus = () => {
    return { status, qrCode: currentQrBase64 };
};

const sendBoletim = async (to, text, imageBase64) => {
    if (status !== 'CONNECTED') {
        throw new Error('WhatsApp não está conectado.');
    }

    try {
        // Formatar o número se não tiver @c.us ou @g.us
        const formattedNumber = to.includes('@') ? to : `${to.replace(/\D/g, '')}@c.us`;

        let media = null;
        if (imageBase64) {
            // Se vier no formato "data:image/png;base64,iVBORw..."
            const base64Data = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;
            media = new MessageMedia('image/png', base64Data, 'boletim.png');
        }

        if (media) {
            await client.sendMessage(formattedNumber, media, { caption: text });
        } else {
            await client.sendMessage(formattedNumber, text);
        }
        return true;
    } catch (error) {
        console.error('Erro ao enviar mensagem via WhatsApp:', error);
        throw error;
    }
};



const getChats = async () => {
    if (status !== 'CONNECTED' || !client) {
        return [];
    }
    try {
        const chats = await client.getChats();
        return chats.map(chat => ({
            id: chat.id._serialized,
            name: chat.name || chat.id.user,
            isGroup: chat.isGroup
        })).sort((a, b) => a.name.localeCompare(b.name));
    } catch (error) {
        console.error('Erro ao buscar conversas:', error);
        return [];
    }
};

module.exports = {
    initializeWhatsApp,
    getStatus,
    sendBoletim,
    getChats
};
