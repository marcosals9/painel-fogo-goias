const db = require('../db');
const { syncFocosData } = require('./focosSync');

const initBroadcastListener = () => {
    // Agora usamos a própria tabela eventos_fogo para disparar a sincronização!
    const channel = db.channel('sync-trigger-listener');

    channel.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'eventos_fogo' }, async (payload) => {
        const row = payload.new;
        // Cavalo de Tróia usa IDs negativos (já que os focos reais são sempre positivos)
        if (row && row.id_evento && row.id_evento < 0) {
            const date = row.data_referencia;
            console.log(`[TRIGGER] Solicitação de sincronização recebida para a data: ${date}`);
            
            // Deleta o registro fantasma imediatamente
            await db.from('eventos_fogo').delete().eq('id_evento', row.id_evento);

            try {
                await syncFocosData(date, 'BRT');
                console.log(`[TRIGGER] Sincronização concluída para a data: ${date}`);
                
                // Manda um broadcast opcional só para destravar a tela, mas a tela agora
                // destrava sozinha quando chegarem os dados novos.
                db.channel('fogo-sync').send({
                    type: 'broadcast',
                    event: 'sync_finished',
                    payload: { date }
                });
            } catch (err) {
                console.error(`[TRIGGER] Erro na sincronização para a data ${date}:`, err);
                db.channel('fogo-sync').send({
                    type: 'broadcast',
                    event: 'sync_finished',
                    payload: { date, error: true }
                });
            }
        }
    });

    channel.subscribe((status) => {
        console.log(`[TRIGGER] Status da assinatura de disparo: ${status}`);
    });
};

module.exports = { initBroadcastListener };
