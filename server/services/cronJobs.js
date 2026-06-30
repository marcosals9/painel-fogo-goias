const cron = require('node-cron');
const { syncFocosData } = require('./focosSync');

function initCronJobs() {
    console.log('[CRON] Inicializando agendador automático de sincronização do CENSIPAM...');

    // Função auxiliar para disparar a sincronização para a data atual no fuso de Brasília (BRT)
    const runSyncForToday = async () => {
        try {
            // Pega a data atual em BRT (UTC-3)
            const today = new Date();
            today.setUTCHours(today.getUTCHours() - 3);
            const dateStr = today.toISOString().split('T')[0];

            console.log(`[CRON] Disparando sincronização automática para a data: ${dateStr}`);
            const total = await syncFocosData(dateStr, 'BRT');
            console.log(`[CRON] Sucesso: ${total} eventos salvos no banco.`);
        } catch (error) {
            console.error('[CRON] Falha na sincronização automática:', error.message);
        }
    };

    // Horários das passagens dos satélites (aos 30 minutos)
    // 04:30, 10:30, 13:30, 16:30, 19:30, 22:30
    cron.schedule('30 4,10,13,16,19,22 * * *', () => {
        console.log('[CRON] Executando sincronização de passagem de satélite...');
        runSyncForToday();
    });

    // Retrato Final do Dia (23:50)
    cron.schedule('50 23 * * *', () => {
        console.log('[CRON] Executando sincronização do RETRATO DO DIA (23:50)...');
        runSyncForToday();
    });

    console.log('[CRON] Rotinas agendadas com sucesso.');
}

module.exports = {
    initCronJobs
};
