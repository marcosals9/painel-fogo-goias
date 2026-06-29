const express = require('express');
const router = express.Router();
const db = require('../db');

// Rota para buscar os eventos salvos no banco para uma determinada data
router.get('/', (req, res) => {
    const { date } = req.query; // Formato YYYY-MM-DD
    
    if (!date) {
        return res.status(400).json({ error: 'Parâmetro date é obrigatório (YYYY-MM-DD)' });
    }

    db.all(`SELECT * FROM eventos_fogo WHERE data_referencia = ?`, [date], (err, rows) => {
        if (err) {
            console.error('Erro ao buscar eventos de fogo:', err);
            return res.status(500).json({ error: 'Erro ao buscar eventos no banco de dados' });
        }
        
        // Formatar de volta para GeoJSON FeatureCollection
        const features = rows.map(row => {
            const geojson = JSON.parse(row.geojson);
            // Incluir as propriedades extraídas e atualizadas
            geojson.properties = {
                ...geojson.properties,
                municipio: row.municipio,
                sigla_uf: row.uf,
                dt_maxima: row.dt_maxima,
                dt_minima: row.dt_minima,
                area_total_evento: row.tamanho_km2,
            };
            
            // Adicionar lat e lng simplificados (primeiro ponto do polígono)
            if (geojson.geometry && geojson.geometry.coordinates && geojson.geometry.coordinates[0]) {
                const firstCoord = geojson.geometry.coordinates[0][0];
                geojson.properties.lng = firstCoord[0];
                geojson.properties.lat = firstCoord[1];
            } else {
                geojson.properties.lng = 0;
                geojson.properties.lat = 0;
            }

            return geojson;
        });

        res.json({
            type: "FeatureCollection",
            features: features
        });
    });
});

// Rota para sincronizar os dados com o CENSIPAM
router.post('/sync', async (req, res) => {
    const { date, tz = 'BRT' } = req.body;
    
    if (!date) {
        return res.status(400).json({ error: 'Parâmetro date é obrigatório (YYYY-MM-DD)' });
    }

    try {
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
            // maxFeatures: 50000,
            CQL_FILTER: `BBOX(geom,-53.25,-19.49,-45.90,-12.39) AND dt_maxima >= '${startFilter}' AND dt_minima <= '${endFilter}'`,
            propertyName: 'id_evento,nome_municipio,sigla_uf,dt_maxima,dt_minima,area_total_evento,qtd_deteccoes,persistencia_dias,nome_unidade_conservacao,geom'
        });

        // Reduzido para 1500 para evitar travamento de Memória (OOM) na VM e2-micro do Google Cloud
        params.set('maxFeatures', '1500');

        console.log(`Buscando dados do CENSIPAM para ${date}...`);
        const response = await fetch(`${baseUrl}?${params.toString()}`);
        
        if (!response.ok) {
            throw new Error(`Erro na API do CENSIPAM: ${response.statusText}`);
        }

        const data = await response.json();
        const features = data.features || [];

        console.log(`Encontrados ${features.length} eventos de fogo no CENSIPAM para a data ${date}`);

        // Iniciar transação no SQLite para inserção
        db.serialize(() => {
            db.run('BEGIN TRANSACTION');
            
            // Deletar os registros antigos para a mesma data de referência para evitar duplicados e permitir atualização
            db.run(`DELETE FROM eventos_fogo WHERE data_referencia = ?`, [date]);

            const stmt = db.prepare(`
                INSERT OR REPLACE INTO eventos_fogo (id_evento, geojson, municipio, uf, dt_maxima, dt_minima, tamanho_km2, data_referencia)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `);

            features.forEach(f => {
                // Limpeza de sujeira da API do Geoserver (ex: [Ljava.lang.String;@...)
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
                const municipio = prop.nome_municipio || 'N/A';
                const uf = prop.sigla_uf || 'N/A';
                const dt_maxima = prop.dt_maxima;
                const dt_minima = prop.dt_minima;
                const tamanho_km2 = prop.area_total_evento || 0;
                
                stmt.run(
                    id_evento, 
                    JSON.stringify(f), 
                    municipio, 
                    uf, 
                    dt_maxima, 
                    dt_minima, 
                    tamanho_km2, 
                    date
                );
            });

            stmt.finalize();
            db.run('COMMIT', (err) => {
                if (err) {
                    console.error('Erro ao comitar transação:', err);
                    return res.status(500).json({ error: 'Erro ao salvar no banco de dados' });
                }
                res.json({ message: 'Sincronização concluída com sucesso', total: features.length });
            });
        });

    } catch (error) {
        console.error('Erro ao sincronizar com CENSIPAM:', error);
        res.status(500).json({ error: 'Falha ao sincronizar com o CENSIPAM' });
    }
});

// Rota para atualizar informações de um evento específico (ex: município resolvido no frontend)
router.put('/:id', (req, res) => {
    const { id } = req.params;
    const { municipio } = req.body;

    if (!municipio) {
        return res.status(400).json({ error: 'Município é obrigatório para atualização' });
    }

    db.run(
        `UPDATE eventos_fogo SET municipio = ? WHERE id_evento = ?`,
        [municipio, id],
        function(err) {
            if (err) {
                console.error('Erro ao atualizar município:', err);
                return res.status(500).json({ error: 'Erro ao atualizar banco de dados' });
            }
            if (this.changes === 0) {
                return res.status(404).json({ error: 'Evento não encontrado' });
            }
            res.json({ message: 'Município atualizado com sucesso' });
        }
    );
});

module.exports = router;
