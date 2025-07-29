// Variáveis globais
let currentSection = "schedule";
let toast;

// Registrar Service Worker para PWA
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        console.log("SW registrado: ", registration);
      })
      .catch((registrationError) => {
        console.log("SW falhou: ", registrationError);
      });
  });
}

// Inicialização
document.addEventListener("DOMContentLoaded", function () {
  // Verificar se está na página principal
  if (window.location.pathname === "/") {
    // Verificar autenticação
    checkAuth().then((authStatus) => {
      if (!authStatus.authenticated) {
        window.location.href = "/login.html";
        return;
      }

      // Usuário autenticado, inicializar aplicação
      updateUserInfo(authStatus.username);
      toast = new bootstrap.Toast(document.getElementById("toast"));
      loadConfig();
      loadMessages();

      // Event listeners
      document
        .getElementById("scheduleForm")
        .addEventListener("submit", handleScheduleSubmit);
      document
        .getElementById("configForm")
        .addEventListener("submit", handleConfigSubmit);

      // Definir data/hora mínima como agora
      const now = new Date();
      const localDateTime = new Date(
        now.getTime() - now.getTimezoneOffset() * 60000
      )
        .toISOString()
        .slice(0, 16);
      document.getElementById("scheduledTime").min = localDateTime;
    });
  }
});

// Função para mostrar seções
function showSection(section) {
  // Esconder todas as seções
  document
    .querySelectorAll(".section")
    .forEach((el) => (el.style.display = "none"));

  // Remover classe active de todos os links
  document
    .querySelectorAll(".nav-link")
    .forEach((el) => el.classList.remove("active"));

  // Mostrar seção selecionada
  document.getElementById(section + "-section").style.display = "block";

  // Adicionar classe active ao link clicado
  event.target.classList.add("active");

  currentSection = section;

  // Recarregar dados se necessário
  if (section === "scheduled") {
    loadMessages();
  } else if (section === "config") {
    loadConfig();
  }
}

// Função para mostrar toast
function showToast(message, type = "success") {
  const toastBody = document.getElementById("toastBody");
  const toast = document.getElementById("toast");

  toastBody.textContent = message;

  // Remover classes de tipo anteriores
  toast.classList.remove("bg-success", "bg-danger", "bg-warning");

  // Adicionar classe de tipo
  if (type === "success") {
    toast.classList.add("bg-success");
  } else if (type === "error") {
    toast.classList.add("bg-danger");
  } else if (type === "warning") {
    toast.classList.add("bg-warning");
  }

  bootstrap.Toast.getInstance(toast).show();
}

// Função para formatar data
function formatDateTime(dateString) {
  const date = new Date(dateString);
  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Função para formatar número de telefone
function formatPhone(phone) {
  return phone.replace(/(\d{2})(\d{2})(\d{5})(\d{4})/, "($1) $2 $3-$4");
}

// Função para obter status da mensagem
function getStatusBadge(message) {
  if (message.sent) {
    return '<span class="status-badge status-sent">Enviado</span>';
  } else if (message.error) {
    return '<span class="status-badge status-error">Erro</span>';
  } else {
    return '<span class="status-badge status-pending">Pendente</span>';
  }
}

// Função para carregar mensagens agendadas
async function loadMessages() {
  try {
    console.log("Carregando mensagens...");

    // Adicionar timestamp para evitar cache
    const response = await fetch("/api/messages?_t=" + Date.now(), {
      method: "GET",
      headers: {
        "Cache-Control": "no-cache",
        Pragma: "no-cache",
      },
    });

    if (!response.ok) {
      console.error("Erro na resposta:", response.status, response.statusText);
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const messages = await response.json();
    console.log("Mensagens recebidas:", messages);

    const messagesList = document.getElementById("messagesList");
    console.log("Elemento messagesList encontrado:", !!messagesList);

    if (messages.length === 0) {
      console.log("Nenhuma mensagem encontrada");
      messagesList.innerHTML = `
                <div class="text-center text-muted">
                    <i class="fas fa-inbox fa-3x mb-3"></i>
                    <p>Nenhuma mensagem agendada</p>
                </div>
            `;
      return;
    }

    messagesList.innerHTML = messages
      .map(
        (message) => `
            <div class="card mb-3">
                <div class="card-body">
                    <div class="row align-items-center">
                        <div class="col-md-3">
                            <strong>Telefone:</strong><br>
                            ${formatPhone(message.phone)}
                        </div>
                        <div class="col-md-3">
                            <strong>Agendado para:</strong><br>
                            ${formatDateTime(message.scheduledTime)}
                        </div>
                        <div class="col-md-3">
                            <strong>Status:</strong><br>
                            ${getStatusBadge(message)}
                        </div>
                        <div class="col-md-3 text-end">
                            <button class="btn btn-sm btn-danger" onclick="deleteMessage('${
                              message.id
                            }')">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </div>
                    <div class="row mt-2">
                        <div class="col-12">
                            <strong>Mensagem:</strong><br>
                            <div class="bg-light p-2 rounded">
                                ${message.message}
                            </div>
                        </div>
                    </div>
                    ${
                      message.error
                        ? `
                        <div class="row mt-2">
                            <div class="col-12">
                                <strong class="text-danger">Erro:</strong><br>
                                <small class="text-danger">${message.error}</small>
                            </div>
                        </div>
                    `
                        : ""
                    }
                </div>
            </div>
        `
      )
      .join("");
  } catch (error) {
    console.error("Erro ao carregar mensagens:", error);
    showToast("Erro ao carregar mensagens", "error");
  }
}

// Função para carregar configurações
async function loadConfig() {
  try {
    const response = await fetch("/api/config");
    const config = await response.json();

    document.getElementById("evolutionApiUrl").value = config.evolutionApiUrl;
    document.getElementById("token").value = config.token;
    document.getElementById("instanceName").value = config.instanceName;
  } catch (error) {
    console.error("Erro ao carregar configurações:", error);
    showToast("Erro ao carregar configurações", "error");
  }
}

// Handler para envio do formulário de agendamento
async function handleScheduleSubmit(event) {
  event.preventDefault();

  const phone = document.getElementById("phone").value.replace(/\D/g, "");
  const message = document.getElementById("message").value;
  const scheduledTime = document.getElementById("scheduledTime").value;

  console.log("Dados do formulário:", { phone, message, scheduledTime });

  if (!phone || !message || !scheduledTime) {
    showToast("Todos os campos são obrigatórios", "error");
    return;
  }

  try {
    const payload = {
      phone,
      message,
      scheduledTime: new Date(scheduledTime).toISOString(),
    };

    console.log("Enviando payload:", payload);

    const response = await fetch("/api/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    console.log("Resposta do agendamento:", response.status, response.ok);

    if (response.ok) {
      const result = await response.json();
      console.log("Mensagem agendada:", result);
      showToast("Mensagem agendada com sucesso!");
      document.getElementById("scheduleForm").reset();

      // Atualizar lista se estiver na seção de mensagens
      if (currentSection === "scheduled") {
        console.log("Atualizando lista de mensagens...");
        // Aguardar um pouco antes de recarregar
        setTimeout(() => {
          loadMessages();
        }, 100);
      }
    } else {
      const error = await response.json();
      console.error("Erro no agendamento:", error);
      showToast(error.error || "Erro ao agendar mensagem", "error");
    }
  } catch (error) {
    console.error("Erro ao agendar mensagem:", error);
    showToast("Erro ao agendar mensagem", "error");
  }
}

// Handler para envio do formulário de configuração
async function handleConfigSubmit(event) {
  event.preventDefault();

  const evolutionApiUrl = document.getElementById("evolutionApiUrl").value;
  const token = document.getElementById("token").value;
  const instanceName = document.getElementById("instanceName").value;

  if (!evolutionApiUrl || !token || !instanceName) {
    showToast("Todos os campos são obrigatórios", "error");
    return;
  }

  try {
    const response = await fetch("/api/config", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        evolutionApiUrl,
        token,
        instanceName,
      }),
    });

    if (response.ok) {
      showToast("Configuração salva com sucesso!");
    } else {
      const error = await response.json();
      showToast(error.error || "Erro ao salvar configuração", "error");
    }
  } catch (error) {
    console.error("Erro ao salvar configuração:", error);
    showToast("Erro ao salvar configuração", "error");
  }
}

// Função para testar conexão com Evolution API
async function testConnection() {
  try {
    showToast("Testando conexão...", "warning");

    const response = await fetch("/api/test-connection", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    });

    const result = await response.json();

    if (result.success) {
      showToast(result.message, "success");
    } else {
      showToast(result.error, "error");
    }
  } catch (error) {
    console.error("Erro ao testar conexão:", error);
    showToast("Erro ao testar conexão", "error");
  }
}

// Função para atualizar mensagens manualmente
function refreshMessages() {
  console.log("Atualizando mensagens manualmente...");
  showToast("Atualizando mensagens...", "warning");
  loadMessages();
}

// Função para deletar mensagem
async function deleteMessage(id) {
  console.log("Tentando deletar mensagem:", id);

  if (!confirm("Tem certeza que deseja remover esta mensagem?")) {
    console.log("Usuário cancelou a exclusão");
    return;
  }

  try {
    console.log("Enviando requisição DELETE para:", `/api/messages/${id}`);
    const response = await fetch(`/api/messages/${id}`, {
      method: "DELETE",
      headers: {
        "Cache-Control": "no-cache",
        Pragma: "no-cache",
      },
    });

    console.log("Resposta da exclusão:", response.status, response.ok);

    if (response.ok) {
      const result = await response.json();
      console.log("Resultado da exclusão:", result);
      showToast("Mensagem removida com sucesso!");
      console.log("Recarregando lista de mensagens...");

      // Aguardar um pouco antes de recarregar
      setTimeout(() => {
        loadMessages();
      }, 100);
    } else {
      const errorData = await response.json();
      console.error("Erro na resposta:", errorData);
      showToast("Erro ao remover mensagem", "error");
    }
  } catch (error) {
    console.error("Erro ao remover mensagem:", error);
    showToast("Erro ao remover mensagem", "error");
  }
}

// Funções de autenticação
async function checkAuth() {
  try {
    const response = await fetch("/api/auth/status");
    return await response.json();
  } catch (error) {
    return { authenticated: false };
  }
}

function updateUserInfo(username) {
  const userInfo = document.getElementById("userInfo");
  if (userInfo) {
    userInfo.textContent = `Logado como: ${username}`;
  }
}

async function logout() {
  try {
    const response = await fetch("/api/logout", {
      method: "POST",
    });

    if (response.ok) {
      window.location.href = "/login.html";
    } else {
      showToast("Erro ao fazer logout", "error");
    }
  } catch (error) {
    console.error("Erro ao fazer logout:", error);
    showToast("Erro ao fazer logout", "error");
  }
}

// Funções para menu mobile
function toggleMobileMenu() {
  const sidebar = document.querySelector(".sidebar");
  const overlay = document.querySelector(".mobile-overlay");

  sidebar.classList.toggle("show");
  overlay.classList.toggle("show");
}

function closeMobileMenu() {
  const sidebar = document.querySelector(".sidebar");
  const overlay = document.querySelector(".mobile-overlay");

  sidebar.classList.remove("show");
  overlay.classList.remove("show");
}

// Fechar menu ao clicar em um link (mobile)
document.addEventListener("DOMContentLoaded", function () {
  const navLinks = document.querySelectorAll(".sidebar .nav-link");
  navLinks.forEach((link) => {
    link.addEventListener("click", function () {
      if (window.innerWidth <= 768) {
        closeMobileMenu();
      }
    });
  });
});
