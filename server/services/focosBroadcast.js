const db = require('../db');
const { syncFocosData } = require('./focosSync');

const initBroadcastListener = () => {
    const channel = db.channel('fogo-sync');

    channel.on('broadcast', { event: 'sync_request' }, async (payload) => {
        if (!payload || !payload.payload) return;
        const { date, tz } = payload.payload;
        
        console.log(`[Broadcast] Recebida solicitação de sincronização para a data: ${date}`);
        try {
            await syncFocosData(date, tz || 'BRT');
            console.log(`[Broadcast] Sincronização concluída com sucesso para a data: ${date}`);
            channel.send({
                type: 'broadcast',
                event: 'sync_finished',
                payload: { date }
            });
        } catch (err) {
            console.error(`[Broadcast] Erro na sincronização para a data ${date}:`, err);
            channel.send({
                type: 'broadcast',
                event: 'sync_finished',
                payload: { date, error: true }
            });
        }
    });

    channel.subscribe((status) => {
        console.log(`[Broadcast] Status da assinatura de sincronização: ${status}`);
    });
};

module.exports = { initBroadcastListener };
