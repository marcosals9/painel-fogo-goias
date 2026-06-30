require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('ERRO CRÍTICO: SUPABASE_URL ou SUPABASE_KEY não configurados no .env!');
}

const db = createClient(supabaseUrl, supabaseKey);

console.log('Conectado ao Supabase (PostgreSQL na nuvem).');

module.exports = db;
