const fs = require('fs');

async function testWFS(usePropertyName = false) {
    const date = '2026-06-29';
    let startFilter = `${date}T03:00:00Z`;
    const d = new Date(date);
    d.setUTCDate(d.getUTCDate() + 1);
    const nextDateStr = d.toISOString().split('T')[0];
    let endFilter = `${nextDateStr}T02:59:59Z`;

    const baseUrl = 'https://panorama.sipam.gov.br/geoserver/painel_do_fogo/wfs';
    const params = new URLSearchParams({
        service: 'WFS',
        version: '1.0.0',
        request: 'GetFeature',
        typeName: 'painel_do_fogo:mv_evento_filtro',
        outputFormat: 'application/json',
        CQL_FILTER: `BBOX(geom,-53.25,-19.49,-45.90,-12.39) AND dt_maxima >= '${startFilter}' AND dt_minima <= '${endFilter}'`,
        maxFeatures: '1500'
    });

    if (usePropertyName) {
        params.set('propertyName', 'id_evento,nome_municipio,sigla_uf,dt_maxima,dt_minima,area_total_evento,qtd_deteccoes,persistencia_dias,nome_unidade_conservacao,geom');
    }

    console.log(`\nTestando ${usePropertyName ? 'COM' : 'SEM'} propertyName...`);
    const start = Date.now();
    
    try {
        const response = await fetch(`${baseUrl}?${params.toString()}`);
        if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        
        const buffer = await response.arrayBuffer();
        const duration = (Date.now() - start) / 1000;
        const sizeMb = (buffer.byteLength / (1024 * 1024)).toFixed(2);
        
        const text = new TextDecoder().decode(buffer);
        const data = JSON.parse(text);
        
        console.log(`- Tempo de resposta: ${duration.toFixed(2)} segundos`);
        console.log(`- Tamanho do payload: ${sizeMb} MB`);
        console.log(`- Quantidade de registros: ${data.features ? data.features.length : 0}`);
        
    } catch (e) {
        console.error(`- Erro: ${e.message}`);
    }
}

async function run() {
    await testWFS(true);
    await testWFS(false);
}

run();
