const express = require('express');
const router = express.Router();
const db = require('../db');

// Rota para buscar os eventos salvos no banco para uma determinada data
router.get('/', async (req, res) => {
    const { date } = req.query; // Formato YYYY-MM-DD
    
    if (!date) {
        return res.status(400).json({ error: 'Parâmetro date é obrigatório (YYYY-MM-DD)' });
    }

    try {
        const { data: rows, error } = await db
            .from('eventos_fogo')
            .select('*')
            .eq('data_referencia', date);

        if (error) {
            console.error('Erro ao buscar eventos de fogo:', error);
            return res.status(500).json({ error: 'Erro ao buscar eventos no banco de dados' });
        }
        
        // Formatar de volta para GeoJSON FeatureCollection
        const features = rows.map(row => {
            let geojson;
            try {
                // Supabase retorna JSONB já como objeto JavaScript, mas se for string, converte
                geojson = typeof row.geojson === 'string' ? JSON.parse(row.geojson) : row.geojson;
            } catch (e) {
                geojson = row.geojson;
            }
            
            // Incluir as propriedades extraídas e atualizadas
            geojson.properties = {
                ...geojson.properties,
                municipio: row.municipio,
                sigla_uf: row.uf,
                dt_maxima: row.dt_maxima,
                dt_minima: row.dt_minima,
                area_total_evento: row.tamanho_km2,
                atualizado_em: row.atualizado_em
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
    } catch (err) {
        console.error('Erro geral ao buscar eventos:', err);
        res.status(500).json({ error: 'Erro no servidor' });
    }
});

// Rota para sincronizar os dados com o CENSIPAM
router.post('/sync', async (req, res) => {
    const { date, tz = 'BRT' } = req.body;
    
    if (!date) {
        return res.status(400).json({ error: 'Parâmetro date é obrigatório (YYYY-MM-DD)' });
    }

    try {
        const { syncFocosData } = require('../services/focosSync');
        const total = await syncFocosData(date, tz);
        res.json({ message: 'Sincronização concluída com sucesso', total: total });
    } catch (error) {
        console.error('Erro na sincronização manual:', error);
        res.status(500).json({ error: 'Erro ao sincronizar dados com o CENSIPAM' });
    }
});

// Rota para atualizar informações de um evento específico (ex: município resolvido no frontend)
    router.put('/:id', async (req, res) => {
    const { id } = req.params;
    const { municipio, uf } = req.body;

    if (!municipio) {
        return res.status(400).json({ error: 'Município é obrigatório para atualização' });
    }

    try {
        const updateData = { municipio };
        if (uf && uf !== 'N/A') {
            updateData.uf = uf;
        }

        const { error } = await db
            .from('eventos_fogo')
            .update(updateData)
            .eq('id_evento', id);

        if (error) {
            console.error('Erro ao atualizar município:', error);
            return res.status(500).json({ error: 'Erro ao atualizar banco de dados' });
        }

        res.json({ message: 'Município atualizado com sucesso' });
    } catch (err) {
        console.error('Erro geral ao atualizar municipio:', err);
        res.status(500).json({ error: 'Erro no servidor' });
    }
});

module.exports = router;
