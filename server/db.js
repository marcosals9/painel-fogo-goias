const fs = require('fs');
const dotenv = require('dotenv');

if (fs.existsSync('.env.development')) {
    dotenv.config({ path: '.env.development' });
    console.log('[ENV] Usando variáveis de ambiente de .env.development');
} else {
    dotenv.config();
    console.log('[ENV] Usando variáveis de ambiente de .env');
}
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('ERRO CRÍTICO: SUPABASE_URL ou SUPABASE_KEY não configurados no .env!');
}

const db = createClient(supabaseUrl, supabaseKey);

console.log('Conectado ao Supabase (PostgreSQL na nuvem).');

module.exports = db;
