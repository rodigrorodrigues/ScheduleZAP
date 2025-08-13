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
          role TEXT DEFAULT 'user',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          force_password_change INTEGER DEFAULT 0
        )
      `,
        (err) => {
          if (err) {
            reject(err);
          } else {
            // Tentar adicionar coluna role se não existir (migração leve)
            db.run(
              "ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'user'",
              () => {
                // Ignorar erro se já existe
                // Criar tabela de configs por usuário
                db.run(
                  `CREATE TABLE IF NOT EXISTS user_configs (
                  id INTEGER PRIMARY KEY,
                  user_id INTEGER NOT NULL,
                  evolutionApiUrl TEXT NOT NULL,
                  token TEXT NOT NULL,
                  instanceName TEXT NOT NULL,
                  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                  FOREIGN KEY(user_id) REFERENCES users(id)
                )`,
                  () => {
                    // Adicionar user_id em mensagens (migração leve)
                    db.run(
                      "ALTER TABLE scheduled_messages ADD COLUMN user_id INTEGER",
                      () => {
                        // Ajustes de migração: garantir roles e admin
                        db.run(
                          "UPDATE users SET role = 'admin' WHERE username = 'admin' AND (role IS NULL OR role = '' OR role = 'user')",
                          () => {
                            db.run(
                              "UPDATE users SET role = 'user' WHERE role IS NULL OR role = ''",
                              () => {
                                // Adicionar coluna force_password_change se não existir
                                db.run(
                                  "ALTER TABLE users ADD COLUMN force_password_change INTEGER DEFAULT 0",
                                  () => {
                                    // Criar usuário padrão se não existir
                                    createDefaultUser()
                                      .then(resolve)
                                      .catch(reject);
                                  }
                                );
                              }
                            );
                          }
                        );
                      }
                    );
                  }
                );
              }
            );
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
          "INSERT INTO users (username, password, role, force_password_change) VALUES (?, ?, ?, ?)",
          ["admin", hashedPassword, "admin", 0],
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

// Configuração por usuário
function getUserConfig(userId) {
  return new Promise((resolve, reject) => {
    db.get(
      "SELECT * FROM user_configs WHERE user_id = ? ORDER BY id DESC LIMIT 1",
      [userId],
      (err, row) => {
        if (err) {
          reject(err);
        } else if (row) {
          resolve(row);
        } else {
          // Fallback para config global
          getConfig().then(resolve).catch(reject);
        }
      }
    );
  });
}

function saveUserConfig(userId, config) {
  return new Promise((resolve, reject) => {
    db.run(
      "INSERT INTO user_configs (user_id, evolutionApiUrl, token, instanceName) VALUES (?, ?, ?, ?)",
      [userId, config.evolutionApiUrl, config.token, config.instanceName],
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

function getMessagesByUser(userId) {
  return new Promise((resolve, reject) => {
    db.all(
      "SELECT * FROM scheduled_messages WHERE user_id = ? ORDER BY scheduledTime DESC",
      [userId],
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
      "INSERT INTO scheduled_messages (id, phone, message, scheduledTime, createdAt, sent, user_id) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [
        message.id,
        message.phone,
        message.message,
        message.scheduledTime,
        message.createdAt,
        message.sent ? 1 : 0,
        message.userId || null,
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
          resolve(null);
        } else {
          const isValid = await bcrypt.compare(password, row.password);
          if (!isValid) return resolve(null);
          resolve({
            id: row.id,
            username: row.username,
            role: row.role || "user",
            forcePasswordChange: Boolean(row.force_password_change),
          });
        }
      }
    );
  });
}

function checkForcePasswordChange(userId) {
  return new Promise((resolve, reject) => {
    db.get(
      "SELECT force_password_change FROM users WHERE id = ?",
      [userId],
      (err, row) => {
        if (err) return reject(err);
        resolve(row ? Boolean(row.force_password_change) : false);
      }
    );
  });
}

function clearForcePasswordChange(userId) {
  return new Promise((resolve, reject) => {
    db.run(
      "UPDATE users SET force_password_change = 0 WHERE id = ?",
      [userId],
      function (err) {
        if (err) return reject(err);
        resolve();
      }
    );
  });
}

function listUsers() {
  return new Promise((resolve, reject) => {
    db.all(
      "SELECT id, username, role, created_at FROM users ORDER BY id ASC",
      (err, rows) => {
        if (err) return reject(err);
        resolve(rows);
      }
    );
  });
}

async function createUser(
  username,
  password,
  role = "user",
  forcePasswordChange = false
) {
  const hashedPassword = await bcrypt.hash(password, 10);
  return new Promise((resolve, reject) => {
    db.run(
      "INSERT INTO users (username, password, role, force_password_change) VALUES (?, ?, ?, ?)",
      [username, hashedPassword, role, forcePasswordChange ? 1 : 0],
      function (err) {
        if (err) return reject(err);
        resolve({ id: this.lastID, username, role });
      }
    );
  });
}

function deleteUser(userId) {
  return new Promise((resolve, reject) => {
    db.run("DELETE FROM users WHERE id = ?", [userId], function (err) {
      if (err) return reject(err);
      resolve();
    });
  });
}

function updateUserRole(userId, role) {
  return new Promise((resolve, reject) => {
    db.run(
      "UPDATE users SET role = ? WHERE id = ?",
      [role, userId],
      function (err) {
        if (err) return reject(err);
        resolve();
      }
    );
  });
}

function updateUserPassword(userId, password, forcePasswordChange = false) {
  return new Promise(async (resolve, reject) => {
    try {
      const hashedPassword = await bcrypt.hash(password, 10);
      db.run(
        "UPDATE users SET password = ?, force_password_change = ? WHERE id = ?",
        [hashedPassword, forcePasswordChange ? 1 : 0, userId],
        function (err) {
          if (err) return reject(err);
          resolve();
        }
      );
    } catch (error) {
      reject(error);
    }
  });
}

// Funções de estatísticas
function getTotalUsers() {
  return new Promise((resolve, reject) => {
    db.get("SELECT COUNT(*) as count FROM users", (err, row) => {
      if (err) return reject(err);
      resolve(row ? row.count : 0);
    });
  });
}

function getTotalMessages() {
  return new Promise((resolve, reject) => {
    db.get("SELECT COUNT(*) as count FROM scheduled_messages", (err, row) => {
      if (err) return reject(err);
      resolve(row ? row.count : 0);
    });
  });
}

function getTotalAdmins() {
  return new Promise((resolve, reject) => {
    db.get(
      "SELECT COUNT(*) as count FROM users WHERE role = 'admin'",
      (err, row) => {
        if (err) return reject(err);
        resolve(row ? row.count : 0);
      }
    );
  });
}

function getUserByUsername(username) {
  return new Promise((resolve, reject) => {
    db.get("SELECT * FROM users WHERE username = ?", [username], (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });
}

function getUserById(userId) {
  return new Promise((resolve, reject) => {
    db.get("SELECT * FROM users WHERE id = ?", [userId], (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });
}

module.exports = {
  initDatabase,
  getConfig,
  getUserConfig,
  saveUserConfig,
  saveConfig,
  getAllMessages,
  getMessagesByUser,
  saveMessage,
  updateMessageStatus,
  deleteMessage,
  authenticateUser,
  listUsers,
  createUser,
  deleteUser,
  updateUserRole,
  updateUserPassword,
  getTotalUsers,
  getTotalMessages,
  getTotalAdmins,
  getUserByUsername,
  checkForcePasswordChange,
  clearForcePasswordChange,
  getUserById,
};
