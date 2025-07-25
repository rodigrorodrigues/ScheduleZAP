const axios = require("axios");

async function testBackend() {
  try {
    console.log("🧪 Testando backend...");

    // Teste 1: GET /api/schedules
    console.log("1. Testando GET /api/schedules...");
    const response = await axios.get("http://localhost:8999/api/schedules");
    console.log("✅ GET /api/schedules:", response.data);

    // Teste 2: POST /api/schedules
    console.log("2. Testando POST /api/schedules...");
    const testMessage = {
      number: "5511999999999",
      message: "Teste de agendamento",
      scheduledAt: new Date(Date.now() + 60000).toISOString(), // 1 minuto no futuro
      apiUrl: "http://localhost:8080/",
      instance: "test-instance",
      token: "test-token",
    };

    const postResponse = await axios.post(
      "http://localhost:8999/api/schedules",
      testMessage
    );
    console.log("✅ POST /api/schedules:", postResponse.data);

    // Teste 3: GET novamente para verificar
    console.log("3. Verificando se foi salvo...");
    const response2 = await axios.get("http://localhost:8999/api/schedules");
    console.log("✅ GET /api/schedules (após POST):", response2.data);

    console.log("🎉 Todos os testes passaram!");
  } catch (error) {
    console.error("❌ Erro no teste:", error.message);
    if (error.response) {
      console.error("Status:", error.response.status);
      console.error("Data:", error.response.data);
    }
  }
}

testBackend();
