const cron = require('node-cron');
const { syncFocosData } = require('./focosSync');
const db = require('../db');

let activeCronJob = null;

const runSyncForToday = async () => {
    try {
        const today = new Date();
        today.setUTCHours(today.getUTCHours() - 3);
        const dateStr = today.toISOString().split('T')[0];

        console.log(`[CRON] Disparando sincronização automática para a data: ${dateStr}`);
        const total = await syncFocosData(dateStr, 'BRT');
        console.log(`[CRON] Sucesso: ${total} eventos salvos no banco.`);

        // Atualizar status de sucesso no banco
        await db.from('system_settings').update({
            last_sync_status: 'success',
            last_sync_time: new Date().toISOString()
        }).eq('id', '00000000-0000-0000-0000-000000000001');

    } catch (error) {
        console.error('[CRON] Falha na sincronização automática:', error.message);
        
        // Atualizar status de falha no banco
        await db.from('system_settings').update({
            last_sync_status: 'error',
            last_sync_time: new Date().toISOString()
        }).eq('id', '00000000-0000-0000-0000-000000000001');
    }
};

const scheduleCron = (cronExpression, enabled) => {
    // Parar cron existente se houver
    if (activeCronJob) {
        activeCronJob.stop();
        activeCronJob = null;
        console.log('[CRON] Agendamento anterior parado.');
    }

    if (!enabled) {
        console.log('[CRON] Sincronização automática está DESATIVADA nas configurações.');
        return;
    }

    if (cron.validate(cronExpression)) {
        activeCronJob = cron.schedule(cronExpression, () => {
            console.log('[CRON] Executando sincronização de satélite baseada na expressão:', cronExpression);
            runSyncForToday();
        });
        console.log(`[CRON] Sincronização automática AGENDADA. Expressão: ${cronExpression}`);
    } else {
        console.error(`[CRON] Expressão CRON inválida no banco de dados: ${cronExpression}`);
    }
};

async function initCronJobs() {
    console.log('[CRON] Inicializando agendador automático de sincronização do CENSIPAM...');

    // 1. Buscar a configuração inicial
    const { data: settings, error } = await db
        .from('system_settings')
        .select('cron_expression, cron_enabled')
        .eq('id', '00000000-0000-0000-0000-000000000001')
        .single();

    if (error) {
        console.error('[CRON] Erro ao buscar configuração inicial do CRON:', error.message);
    } else if (settings) {
        scheduleCron(settings.cron_expression, settings.cron_enabled);
    }

    // Retrato Final do Dia (Fixo 23:50) - Pode ser colocado dinâmico também se desejarem, mas deixaremos fixo como backup por enquanto,
    // ou deixamos tudo para o CRON dinâmico. O antigo tinha 23:50 fixo. Vamos manter fixo como fallback diário.
    cron.schedule('50 23 * * *', () => {
        console.log('[CRON] Executando sincronização do RETRATO DO DIA (23:50)...');
        runSyncForToday();
    });

    // 2. Assinar Realtime para mudanças no CRON
    db.channel('custom-all-channel')
        .on(
            'postgres_changes',
            { event: 'UPDATE', schema: 'public', table: 'system_settings' },
            (payload) => {
                console.log('[CRON] Detectada alteração nas configurações do sistema via Realtime!');
                const newSettings = payload.new;
                scheduleCron(newSettings.cron_expression, newSettings.cron_enabled);
            }
        )
        .subscribe();
}

module.exports = {
    initCronJobs
};
