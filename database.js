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
      // Tabela de configuração global (Evolution API)
      db.run(`
        CREATE TABLE IF NOT EXISTS global_config (
          id INTEGER PRIMARY KEY,
          evolution_api_url TEXT NOT NULL,
          evolution_api_token TEXT NOT NULL,
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
          error TEXT,
          user_id INTEGER NOT NULL,
          FOREIGN KEY(user_id) REFERENCES users(id)
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
          force_password_change INTEGER DEFAULT 0,
          instance_name TEXT UNIQUE,
          instance_connected INTEGER DEFAULT 0,
          instance_qr_code TEXT,
          instance_status TEXT DEFAULT 'disconnected'
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
                // Tentar adicionar colunas de instância se não existirem
                db.run(
                  "ALTER TABLE users ADD COLUMN instance_name TEXT",
                  () => {
                    db.run(
                      "ALTER TABLE users ADD COLUMN instance_connected INTEGER DEFAULT 0",
                      () => {
                        db.run(
                          "ALTER TABLE users ADD COLUMN instance_qr_code TEXT",
                          () => {
                            db.run(
                              "ALTER TABLE users ADD COLUMN instance_status TEXT DEFAULT 'disconnected'",
                              () => {
                                // Ignorar erros se já existem
                              }
                            );
                          }
                        );
                      }
                    );
                  }
                );
                // Ignorar erro se já existe
                // Criar tabela de instâncias por usuário
                db.run(
                  `CREATE TABLE IF NOT EXISTS user_instances (
                  id INTEGER PRIMARY KEY,
                  user_id INTEGER NOT NULL,
                  name TEXT NOT NULL,
                  evolutionApiUrl TEXT NOT NULL,
                  token TEXT NOT NULL,
                  instanceName TEXT NOT NULL,
                  is_active INTEGER DEFAULT 1,
                  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                  FOREIGN KEY(user_id) REFERENCES users(id)
                )`,
                  () => {
                    // Adicionar user_id e instance_id em mensagens (migração leve)
                    db.run(
                      "ALTER TABLE scheduled_messages ADD COLUMN user_id INTEGER",
                      () => {
                        db.run(
                          "ALTER TABLE scheduled_messages ADD COLUMN instance_id INTEGER",
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

// Funções para gerenciar configuração global
function getGlobalConfig() {
  return new Promise((resolve, reject) => {
    console.log("Buscando configuração global no banco...");
    db.get(
      "SELECT * FROM global_config ORDER BY id DESC LIMIT 1",
      (err, row) => {
        if (err) {
          console.error("Erro ao buscar configuração global:", err);
          reject(err);
        } else {
          console.log(
            "Configuração global encontrada:",
            row
              ? {
                  id: row.id,
                  url: row.evolution_api_url,
                  hasToken: !!row.evolution_api_token,
                }
              : "Nenhuma configuração"
          );
          resolve(row);
        }
      }
    );
  });
}

function saveGlobalConfig(config) {
  return new Promise((resolve, reject) => {
    console.log("Salvando configuração global no banco:", {
      url: config.evolution_api_url,
      hasToken: !!config.evolution_api_token,
    });

    db.run(
      "INSERT INTO global_config (evolution_api_url, evolution_api_token) VALUES (?, ?)",
      [config.evolution_api_url, config.evolution_api_token],
      function (err) {
        if (err) {
          console.error("Erro ao salvar configuração global:", err);
          reject(err);
        } else {
          console.log(
            "Configuração global salva com sucesso, ID:",
            this.lastID
          );
          resolve();
        }
      }
    );
  });
}

// Funções para gerenciar instâncias de usuário
function generateInstanceName(username) {
  // Gerar hash baseado no username + timestamp
  const timestamp = Date.now().toString(36);
  const hash = require("crypto")
    .createHash("md5")
    .update(username + timestamp)
    .digest("hex")
    .substring(0, 8);
  return `${username}_${hash}`;
}

function getUserInstanceData(userId) {
  return new Promise((resolve, reject) => {
    db.get(
      "SELECT instance_name, instance_connected, instance_qr_code, instance_status FROM users WHERE id = ?",
      [userId],
      (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      }
    );
  });
}

function updateUserInstance(userId, instanceData) {
  return new Promise((resolve, reject) => {
    db.run(
      "UPDATE users SET instance_name = ?, instance_connected = ?, instance_qr_code = ?, instance_status = ? WHERE id = ?",
      [
        instanceData.instance_name,
        instanceData.instance_connected ? 1 : 0,
        instanceData.instance_qr_code,
        instanceData.instance_status,
        userId,
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

// Funções para gerenciar instâncias por usuário
function getUserInstances(userId) {
  return new Promise((resolve, reject) => {
    db.all(
      "SELECT * FROM user_instances WHERE user_id = ? ORDER BY created_at DESC",
      [userId],
      (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows || []);
        }
      }
    );
  });
}

function getUserInstance(userId, instanceId) {
  return new Promise((resolve, reject) => {
    db.get(
      "SELECT * FROM user_instances WHERE user_id = ? AND id = ?",
      [userId, instanceId],
      (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      }
    );
  });
}

function createUserInstance(userId, instanceData) {
  return new Promise((resolve, reject) => {
    db.run(
      "INSERT INTO user_instances (user_id, name, evolutionApiUrl, token, instanceName) VALUES (?, ?, ?, ?, ?)",
      [
        userId,
        instanceData.name,
        instanceData.evolutionApiUrl,
        instanceData.token,
        instanceData.instanceName,
      ],
      function (err) {
        if (err) {
          reject(err);
        } else {
          resolve({ id: this.lastID, ...instanceData });
        }
      }
    );
  });
}

function updateUserInstanceData(userId, instanceId, instanceData) {
  return new Promise((resolve, reject) => {
    db.run(
      "UPDATE user_instances SET name = ?, evolutionApiUrl = ?, token = ?, instanceName = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ? AND id = ?",
      [
        instanceData.name,
        instanceData.evolutionApiUrl,
        instanceData.token,
        instanceData.instanceName,
        userId,
        instanceId,
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

function deleteUserInstance(userId, instanceId) {
  return new Promise((resolve, reject) => {
    db.run(
      "DELETE FROM user_instances WHERE user_id = ? AND id = ?",
      [userId, instanceId],
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

function setActiveInstance(userId, instanceId) {
  return new Promise((resolve, reject) => {
    db.run(
      "UPDATE user_instances SET is_active = 0 WHERE user_id = ?",
      [userId],
      (err) => {
        if (err) {
          reject(err);
        } else {
          db.run(
            "UPDATE user_instances SET is_active = 1 WHERE user_id = ? AND id = ?",
            [userId, instanceId],
            (err) => {
              if (err) {
                reject(err);
              } else {
                resolve();
              }
            }
          );
        }
      }
    );
  });
}

function getActiveInstance(userId) {
  return new Promise((resolve, reject) => {
    db.get(
      "SELECT * FROM user_instances WHERE user_id = ? AND is_active = 1",
      [userId],
      (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
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
      `SELECT m.*, i.name as instance_name 
       FROM scheduled_messages m 
       LEFT JOIN user_instances i ON m.instance_id = i.id 
       WHERE m.user_id = ? 
       ORDER BY m.scheduledTime DESC`,
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
      "INSERT INTO scheduled_messages (id, phone, message, scheduledTime, createdAt, sent, user_id, instance_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [
        message.id,
        message.phone,
        message.message,
        message.scheduledTime,
        message.createdAt,
        message.sent ? 1 : 0,
        message.userId || null,
        message.instanceId || null,
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
  // Configuração global
  getGlobalConfig,
  saveGlobalConfig,
  // Instâncias de usuário
  generateInstanceName,
  getUserInstanceData,
  updateUserInstance,
  updateUserInstanceData,
  createUserInstance,
  getActiveInstance,
  // Mensagens
  getAllMessages,
  getMessagesByUser,
  saveMessage,
  updateMessageStatus,
  deleteMessage,
  // Usuários
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
