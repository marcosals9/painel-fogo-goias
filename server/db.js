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

    // Inserir usuário mock (admin / admin) se não existir
    db.get("SELECT count(*) as count FROM users WHERE username = 'admin'", (err, row) => {
        if (row && row.count === 0) {
            db.run(`INSERT INTO users (username, password) VALUES ('admin', 'admin')`);
            console.log("Usuário mock criado: admin / admin");
        }
    });
});

module.exports = db;
