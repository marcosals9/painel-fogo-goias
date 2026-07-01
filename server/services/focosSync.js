const db = require('../db');

/**
 * Função para buscar os dados do CENSIPAM e salvar no SQLite
 * Pode ser chamada tanto pela rota manual quanto pelo CRON job automático
 */
async function syncFocosData(date, tz = 'BRT') {
    let startFilter, endFilter;
    if (tz === 'UTC') {
        startFilter = `${date}T00:00:00Z`;
        endFilter = `${date}T23:59:59Z`;
    } else {
        // BRT (UTC-3)
        startFilter = `${date}T03:00:00Z`;
        const d = new Date(date);
        d.setUTCDate(d.getUTCDate() + 1);
        const nextDateStr = d.toISOString().split('T')[0];
        endFilter = `${nextDateStr}T02:59:59Z`;
    }

    const baseUrl = 'https://panorama.sipam.gov.br/geoserver/painel_do_fogo/wfs';
    const params = new URLSearchParams({
        service: 'WFS',
        version: '1.0.0',
        request: 'GetFeature',
        typeName: 'painel_do_fogo:mv_evento_filtro',
        outputFormat: 'application/json',
        CQL_FILTER: `BBOX(geom,-53.25,-19.49,-45.90,-12.39) AND dt_maxima >= '${startFilter}' AND dt_minima <= '${endFilter}'`
    });

    // Reduzido para 1500 para evitar travamento de Memória (OOM) na VM e2-micro
    params.set('maxFeatures', '1500');

    console.log(`[SYNC] Buscando dados do CENSIPAM para ${date} (Fuso: ${tz})...`);
    const startTime = Date.now();

    // Adicionando cabeçalhos de Spoofing (Fingindo ser Chrome) para evitar Throttling do WAF
    const response = await fetch(`${baseUrl}?${params.toString()}`, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
            'Connection': 'keep-alive'
        }
    });
    
    if (!response.ok) {
        throw new Error(`Erro na API do CENSIPAM: ${response.statusText}`);
    }

    const data = await response.json();
    const features = data.features || [];

    const timeTaken = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`[SYNC] Encontrados ${features.length} eventos para a data ${date} em ${timeTaken} segundos.`);

    try {
        // Buscar TODOS os focos já salvos para essa data para fazer o "Diff" Inteligente
        const { data: rows, error: selectError } = await db
            .from('eventos_fogo')
            .select('id_evento, municipio, uf, tamanho_km2, dt_maxima, dt_minima')
            .eq('data_referencia', date);

        const existingEvents = {};
        const preservedCities = {};
        const preservedUFs = {};
        
        if (!selectError && rows) {
            rows.forEach(r => {
                existingEvents[r.id_evento] = r;
                // Preserva cidades e UFs que já foram geocodificadas (Não são N/A, Buscando... etc)
                if (r.municipio && r.municipio !== 'N/A' && r.municipio !== 'Buscando...' && r.municipio !== 'Não Mapeado') {
                    preservedCities[r.id_evento] = r.municipio;
                }
                if (r.uf && r.uf !== 'N/A') {
                    preservedUFs[r.id_evento] = r.uf;
                }
            });
        }

        const incomingIds = new Set();
        const recordsToUpsert = [];

        for (const f of features) {
            Object.keys(f.properties).forEach(key => {
                let val = f.properties[key];
                if (typeof val === 'string') {
                    if (val.includes('[Ljava.lang.')) {
                        f.properties[key] = null;
                    } else {
                        if (val.startsWith('{') && val.endsWith('}')) {
                            f.properties[key] = val.slice(1, -1);
                        }
                        if (f.properties[key] === 'NULL') {
                            f.properties[key] = null;
                        }
                    }
                }
            });

            const prop = f.properties;
            const id_evento = prop.id_evento;
            incomingIds.add(id_evento);

            const dt_maxima = prop.dt_maxima ? prop.dt_maxima : null;
            const dt_minima = prop.dt_minima ? prop.dt_minima : null;
            const tamanho_km2 = prop.area_total_evento || 0;

            // Lógica de Diffing: Só salva se for Novo ou se houve mudança na Área ou Data
            const existing = existingEvents[id_evento];
            let hasChanged = false;

            if (!existing) {
                hasChanged = true;
            } else {
                // Datas vêm do banco como ISO Strings, então precisamos comparar cuidadosamente
                // Tamanho pode ter flutuação flutuante, mas uma checagem simples já filtra 99% das duplicatas
                if (existing.tamanho_km2 !== tamanho_km2) hasChanged = true;
                
                // Converte dt_maxima para string ISO para comparar com a do banco se necessário
                // Mas por segurança, se as datas não batem, consideramos que mudou
                const formatDbDate = (dbDate) => dbDate ? new Date(dbDate).toISOString() : null;
                const formatPropDate = (pDate) => pDate ? new Date(pDate).toISOString() : null;
                
                if (formatDbDate(existing.dt_maxima) !== formatPropDate(dt_maxima)) hasChanged = true;
            }

            if (hasChanged) {
                let municipio = preservedCities[id_evento] || prop.nome_municipio || 'N/A';
                let uf = preservedUFs[id_evento] || prop.sigla_uf || 'N/A';

                // Realizar Geocodificação Reversa se faltar município
                if (municipio === 'N/A' || municipio === 'Não Mapeado' || uf === 'N/A' || municipio === 'Desconhecido') {
                    let lat, lng;
                    if (f.geometry && f.geometry.coordinates && f.geometry.coordinates[0]) {
                        let coords = f.geometry.coordinates;
                        while (coords[0] && Array.isArray(coords[0]) && Array.isArray(coords[0][0])) {
                            coords = coords[0];
                        }
                        if (coords[0] && coords[0].length >= 2) {
                            lng = coords[0][0];
                            lat = coords[0][1];
                        }
                    }

                    if (lat !== undefined && lng !== undefined) {
                        try {
                            const res = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=pt`);
                            if (res.ok) {
                                const gData = await res.json();
                                municipio = gData.city || gData.locality || 'Desconhecido';
                                if (gData.principalSubdivisionCode) {
                                    const parts = gData.principalSubdivisionCode.split('-');
                                    uf = parts[parts.length - 1]; // ex: "BR-MT" -> "MT"
                                } else {
                                    uf = '--';
                                }
                                console.log(`[GEOCODE] ${id_evento}: ${municipio} - ${uf}`);
                            } else {
                                municipio = 'Desconhecido';
                                uf = '--';
                            }
                        } catch (e) {
                            console.error(`[GEOCODE] Erro no foco ${id_evento}:`, e.message);
                            municipio = 'Desconhecido';
                            uf = '--';
                        }
                        // Delay de 200ms para evitar bloqueio da API gratuita
                        await new Promise(r => setTimeout(r, 200));
                    }
                }

                recordsToUpsert.push({
                    id_evento,
                    geojson: f,
                    municipio,
                    uf,
                    dt_maxima,
                    dt_minima,
                    tamanho_km2,
                    data_referencia: date
                });
            }
        }

        const idsToDelete = [];
        if (rows) {
            rows.forEach(r => {
                if (!incomingIds.has(r.id_evento)) {
                    idsToDelete.push(r.id_evento);
                }
            });
        }

        // Executa as deleções apenas do que realmente sumiu
        if (idsToDelete.length > 0) {
            const { error: deleteError } = await db
                .from('eventos_fogo')
                .delete()
                .in('id_evento', idsToDelete);
            
            if (deleteError) {
                 console.error('[SYNC] Erro ao deletar registros obsoletos:', deleteError);
            }
        }

        // Executa o upsert apenas dos novos ou alterados
        if (recordsToUpsert.length > 0) {
            const { error: insertError } = await db
                .from('eventos_fogo')
                .upsert(recordsToUpsert, { onConflict: 'id_evento, data_referencia' });

            if (insertError) {
                console.error('[SYNC] Erro ao inserir novos registros no Supabase:', insertError);
                throw insertError;
            }
            console.log(`[SYNC] ${recordsToUpsert.length} focos novos ou alterados foram salvos.`);
        } else {
            console.log(`[SYNC] Nenhum foco novo ou alterado. Banco já estava atualizado!`);
        }

        return features.length;

    } catch (err) {
        console.error('[SYNC] Erro na transação Supabase:', err);
        throw err;
    }
}

module.exports = {
    syncFocosData
};
