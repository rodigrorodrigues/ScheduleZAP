import express from "express";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configurar servidor Express
const app = express();

// Servir arquivos estáticos
app.use(express.static(join(__dirname, "dist")));

// Rota fallback para SPA
app.get("*", (req, res) => {
  res.sendFile(join(__dirname, "dist", "index.html"));
});

// Iniciar servidor
app.listen(8988, "0.0.0.0", () => {
  console.log("🚀 Frontend rodando na porta 8988");
});
