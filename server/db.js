const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'codec.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Erro ao conectar ao banco de dados SQLite:', err.message);
    } else {
        console.log('Conectado ao banco de dados SQLite.');
    }
});

// Inicialização das tabelas
db.serialize(() => {
    // Tabela de usuários para a área restrita
    db.run(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            role TEXT DEFAULT 'admin'
        )
    `);

    // Tabela de informativos
    db.run(`
        CREATE TABLE IF NOT EXISTS informativos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            titulo TEXT NOT NULL,
            texto_boletim TEXT NOT NULL,
            imagem_base64 TEXT,
            destinatario TEXT,
            status_envio TEXT,
            criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Tabela de eventos diários
    db.run(`
        CREATE TABLE IF NOT EXISTS eventos_diarios (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            descricao TEXT NOT NULL,
            data_evento DATE NOT NULL,
            criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Tabela de cache de eventos de fogo (CENSIPAM)
    db.run(`
        CREATE TABLE IF NOT EXISTS eventos_fogo (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            id_evento INTEGER UNIQUE NOT NULL,
            geojson TEXT NOT NULL,
            municipio TEXT,
            uf TEXT,
            dt_maxima DATETIME,
            dt_minima DATETIME,
            tamanho_km2 REAL,
            data_referencia DATE NOT NULL,
            criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Inserir usuário mock (admin / admin) se não existir
    db.get("SELECT count(*) as count FROM users WHERE username = 'admin'", (err, row) => {
        if (row && row.count === 0) {
            db.run(`INSERT INTO users (username, password) VALUES ('admin', 'admin')`);
            console.log("Usuário mock criado: admin / admin");
        }
    });
});

module.exports = db;
