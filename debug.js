#!/usr/bin/env node

console.log("🔍 ScheduleZAP - Debug Script");
console.log("==============================");

// Verificar Node.js
console.log(`📦 Node.js version: ${process.version}`);
console.log(`📁 Current directory: ${process.cwd()}`);

// Verificar arquivos essenciais
const fs = require("fs");
const path = require("path");

const requiredFiles = [
  "docker-entrypoint.js",
  "package.json",
  "backend/package.json",
  "public/index.html",
];

console.log("\n📋 Verificando arquivos essenciais:");
requiredFiles.forEach((file) => {
  const exists = fs.existsSync(file);
  console.log(`${exists ? "✅" : "❌"} ${file}`);
});

// Verificar portas
const net = require("net");

function checkPort(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.listen(port, () => {
      server.once("close", () => {
        resolve(true);
      });
      server.close();
    });
    server.on("error", () => {
      resolve(false);
    });
  });
}

async function checkPorts() {
  console.log("\n🔌 Verificando portas:");
  const ports = [8988, 8999];
  for (const port of ports) {
    const available = await checkPort(port);
    console.log(`${available ? "✅" : "❌"} Porta ${port} disponível`);
  }
}

// Verificar variáveis de ambiente
console.log("\n🌍 Variáveis de ambiente:");
console.log(`NODE_ENV: ${process.env.NODE_ENV || "não definido"}`);
console.log(
  `VITE_PASSWORD: ${process.env.VITE_PASSWORD ? "definido" : "não definido"}`
);

// Verificar sistema
const os = require("os");
console.log(`\n💻 Sistema: ${os.platform()} ${os.release()}`);
console.log(`🧠 Memória: ${Math.round(os.totalmem() / 1024 / 1024)}MB total`);

// Testar conectividade básica
console.log("\n🌐 Testando conectividade:");
const http = require("http");

function testUrl(url) {
  return new Promise((resolve) => {
    const req = http.get(url, (res) => {
      resolve(`✅ ${url} - Status: ${res.statusCode}`);
    });
    req.on("error", () => {
      resolve(`❌ ${url} - Erro de conexão`);
    });
    req.setTimeout(5000, () => {
      resolve(`⏰ ${url} - Timeout`);
    });
  });
}

async function testConnectivity() {
  const tests = [
    "http://localhost:8988",
    "http://localhost:8999/api/schedules",
  ];

  for (const test of tests) {
    const result = await testUrl(test);
    console.log(result);
  }
}

// Executar verificações
async function runDebug() {
  await checkPorts();
  await testConnectivity();

  console.log("\n🎯 Recomendações:");
  console.log("1. Se algum arquivo estiver faltando, verifique o build");
  console.log(
    "2. Se as portas não estiverem disponíveis, verifique se outro serviço está usando"
  );
  console.log(
    "3. Se a conectividade falhar, verifique se o container está rodando"
  );
  console.log("4. Configure VITE_PASSWORD se necessário");
}

runDebug().catch(console.error);
