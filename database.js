const sqlite3 = require("sqlite3").verbose();
const bcrypt = require("bcryptjs");
const path = require("path");

// Criar diretório data se não existir
const dataDir = path.join(__dirname, "data");
if (!require("fs").existsSync(dataDir)) {
  require("fs").mkdirSync(dataDir, { recursive: true });
}

// Criar conexão com o banco
const dbPath = path.join(dataDir, "schedulezap.db");
const db = new sqlite3.Database(dbPath);

// Inicializar banco de dados
function initDatabase() {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      // Tabela de configurações
      db.run(`
        CREATE TABLE IF NOT EXISTS config (
          id INTEGER PRIMARY KEY,
          evolutionApiUrl TEXT NOT NULL,
          token TEXT NOT NULL,
          instanceName TEXT NOT NULL,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Tabela de mensagens agendadas
      db.run(`
        CREATE TABLE IF NOT EXISTS scheduled_messages (
          id TEXT PRIMARY KEY,
          phone TEXT NOT NULL,
          message TEXT NOT NULL,
          scheduledTime TEXT NOT NULL,
          createdAt TEXT NOT NULL,
          sent INTEGER DEFAULT 0,
          sentAt TEXT,
          error TEXT
        )
      `);

      // Tabela de usuários (para autenticação)
      db.run(
        `
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY,
          username TEXT UNIQUE NOT NULL,
          password TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `,
        (err) => {
          if (err) {
            reject(err);
          } else {
            // Criar usuário padrão se não existir
            createDefaultUser().then(resolve).catch(reject);
          }
        }
      );
    });
  });
}

// Criar usuário padrão
async function createDefaultUser() {
  const hashedPassword = await bcrypt.hash("Lucas4tlof!", 10);

  return new Promise((resolve, reject) => {
    db.get("SELECT id FROM users WHERE username = 'admin'", (err, row) => {
      if (err) {
        reject(err);
        return;
      }

      if (!row) {
        db.run(
          "INSERT INTO users (username, password) VALUES (?, ?)",
          ["admin", hashedPassword],
          (err) => {
            if (err) {
              reject(err);
            } else {
              console.log("Usuário padrão criado: admin / Lucas4tlof!");
              resolve();
            }
          }
        );
      } else {
        resolve();
      }
    });
  });
}

// Funções para configurações
function getConfig() {
  return new Promise((resolve, reject) => {
    db.get("SELECT * FROM config ORDER BY id DESC LIMIT 1", (err, row) => {
      if (err) {
        reject(err);
      } else {
        resolve(
          row || {
            evolutionApiUrl: "http://localhost:8080",
            token: "",
            instanceName: "default",
          }
        );
      }
    });
  });
}

function saveConfig(config) {
  return new Promise((resolve, reject) => {
    db.run(
      "INSERT INTO config (evolutionApiUrl, token, instanceName) VALUES (?, ?, ?)",
      [config.evolutionApiUrl, config.token, config.instanceName],
      function (err) {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      }
    );
  });
}

// Funções para mensagens agendadas
function getAllMessages() {
  return new Promise((resolve, reject) => {
    db.all(
      "SELECT * FROM scheduled_messages ORDER BY scheduledTime DESC",
      (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(
            rows.map((row) => ({
              ...row,
              sent: Boolean(row.sent),
            }))
          );
        }
      }
    );
  });
}

function saveMessage(message) {
  return new Promise((resolve, reject) => {
    db.run(
      "INSERT INTO scheduled_messages (id, phone, message, scheduledTime, createdAt, sent) VALUES (?, ?, ?, ?, ?, ?)",
      [
        message.id,
        message.phone,
        message.message,
        message.scheduledTime,
        message.createdAt,
        message.sent ? 1 : 0,
      ],
      function (err) {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      }
    );
  });
}

function updateMessageStatus(id, sent, sentAt, error) {
  return new Promise((resolve, reject) => {
    const params = [sent ? 1 : 0, sentAt, error, id];
    db.run(
      "UPDATE scheduled_messages SET sent = ?, sentAt = ?, error = ? WHERE id = ?",
      params,
      function (err) {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      }
    );
  });
}

function deleteMessage(id) {
  return new Promise((resolve, reject) => {
    db.run("DELETE FROM scheduled_messages WHERE id = ?", [id], function (err) {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

// Funções para autenticação
function authenticateUser(username, password) {
  return new Promise((resolve, reject) => {
    db.get(
      "SELECT * FROM users WHERE username = ?",
      [username],
      async (err, row) => {
        if (err) {
          reject(err);
        } else if (!row) {
          resolve(false);
        } else {
          const isValid = await bcrypt.compare(password, row.password);
          resolve(isValid);
        }
      }
    );
  });
}

module.exports = {
  initDatabase,
  getConfig,
  saveConfig,
  getAllMessages,
  saveMessage,
  updateMessageStatus,
  deleteMessage,
  authenticateUser,
};
