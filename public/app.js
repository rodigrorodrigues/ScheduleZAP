// Variáveis globais
let currentSection = "schedule";
let toast;
// Cache de grupos: id -> nome
let groupsMap = {};

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
  console.log("DOM carregado");
  console.log("Bootstrap disponível:", typeof bootstrap !== "undefined");

  // Verificar se está na aplicação (index) e não na tela de login
  const isAppPage =
    window.location.pathname === "/" ||
    window.location.pathname.endsWith("/index.html");
  const isLoginPage = window.location.pathname.endsWith("/login.html");

  if (isAppPage && !isLoginPage) {
    // Verificar autenticação
    checkAuth().then((authStatus) => {
      if (!authStatus.authenticated) {
        window.location.href = "/login.html";
        return;
      }

      // Usuário autenticado, inicializar aplicação
      const username = authStatus.user?.username || authStatus.username || "";
      const role = authStatus.user?.role || null;
      const isAdmin = role === "admin" || username === "admin";
      const adminNav = document.getElementById("adminNav");
      console.log("Auth user:", { username, role, isAdmin });
      if (adminNav) {
        if (isAdmin) {
          adminNav.classList.remove("d-none");
        } else {
          adminNav.classList.add("d-none");
        }
      }
      updateUserInfo(username);
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

// Carregar cache de grupos do backend para mapear id -> nome
async function loadGroupsCacheIfNeeded() {
  try {
    // Se já temos grupos no cache, evitar chamada
    if (groupsMap && Object.keys(groupsMap).length > 0) return;

    const res = await fetch(`/api/config/status?_t=${Date.now()}`);
    const cfg = await res.json();
    if (!cfg.hasConfig) return;

    const res2 = await fetch(`/api/chats?_t=${Date.now()}`, {
      headers: {
        "Cache-Control": "no-cache, no-store, must-revalidate",
        Pragma: "no-cache",
      },
    });
    if (!res2.ok) return;
    const data = await res2.json();
    if (data && Array.isArray(data.chats)) {
      const map = {};
      data.chats.forEach((c) => {
        if (c && c.id && c.name) {
          map[c.id] = c.name;
        }
      });
      groupsMap = map;
    }
  } catch (e) {
    // Silenciar erros de cache
  }
}

// Retornar display do destinatário: nome do grupo se JID, senão telefone formatado
function getRecipientDisplay(value) {
  if (typeof value === "string" && value.includes("@g.us")) {
    return groupsMap[value] || "Grupo";
  }
  return formatPhone(value);
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
  if (typeof phone === "string" && phone.includes("@g.us")) {
    return "Grupo";
  }
  const onlyDigits = String(phone || "").replace(/\D/g, "");
  if (/^\d{10,15}$/.test(onlyDigits)) {
    return onlyDigits.replace(/(\d{2})(\d{2})(\d{5})(\d{4})/, "($1) $2 $3-$4");
  }
  return String(phone || "");
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
    // Garantir cache de grupos para exibir nomes no lugar do JID
    await loadGroupsCacheIfNeeded();
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
                            ${getRecipientDisplay(message.phone)}
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

  const rawPhone = document.getElementById("phone").value.trim();
  const phone = rawPhone.includes("@g.us")
    ? rawPhone
    : rawPhone.replace(/\D/g, "");
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
    showToast("Testando conexão com Evolution API v2...", "warning");

    const response = await fetch("/api/evolution/test", {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache, no-store, must-revalidate",
        Pragma: "no-cache",
      },
    });

    const result = await response.json();

    if (result.success) {
      showToast(
        `${result.message} - ${result.instance.foundChats} chats encontrados`,
        "success"
      );
      console.log("Teste de conexão bem-sucedido:", result);
    } else {
      showToast(`Erro: ${result.error}`, "error");
      console.error("Erro no teste de conexão:", result);
    }
  } catch (error) {
    console.error("Erro ao testar conexão:", error);
    showToast("Erro ao testar conexão com Evolution API v2", "error");
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

// Admin: carregar, criar e deletar usuários
async function loadUsers() {
  try {
    showToast("Carregando usuários...", "info");
    const res = await fetch("/api/admin/users");
    if (!res.ok) throw new Error("Falha ao carregar usuários");
    const users = await res.json();
    const usersList = document.getElementById("usersList");

    if (users.length === 0) {
      usersList.innerHTML =
        '<div class="text-center text-muted p-3">Nenhum usuário encontrado</div>';
      updateStats(users);
      return;
    }

    usersList.innerHTML = users
      .map(
        (u) => `
        <div class="d-flex justify-content-between align-items-center border rounded p-2 mb-2">
          <div class="flex-grow-1">
            <div class="d-flex align-items-center">
              <strong class="me-2">#${u.id}</strong>
              <span class="me-2">${u.username}</span>
              <span class="badge ${
                u.role === "admin" ? "bg-danger" : "bg-secondary"
              }">${u.role}</span>
              <small class="text-muted ms-2">${new Date(
                u.created_at
              ).toLocaleDateString("pt-BR")}</small>
            </div>
          </div>
          <div class="btn-group btn-group-sm">
            <button class="btn btn-outline-info" onclick="openUserConfigModal(${
              u.id
            }, '${u.username}')" title="Configurações">
              <i class="fas fa-cog"></i>
            </button>
            <button class="btn btn-outline-primary" onclick="editUser(${
              u.id
            }, '${u.username}', '${u.role}')" title="Editar">
              <i class="fas fa-edit"></i>
            </button>
            <button class="btn btn-outline-warning" onclick="resetUserPassword(${
              u.id
            }, '${u.username}')" title="Redefinir senha">
              <i class="fas fa-key"></i>
            </button>
            <button class="btn btn-outline-danger" onclick="deleteUser(${
              u.id
            }, '${u.username}')" title="Excluir">
              <i class="fas fa-trash"></i>
            </button>
          </div>
        </div>`
      )
      .join("");

    updateStats(users);
    showToast(`${users.length} usuário(s) carregado(s)`, "success");
  } catch (e) {
    console.error("Erro ao carregar usuários:", e);
    showToast("Erro ao carregar usuários: " + e.message, "error");
  }
}

// Abrir modal de criação de usuário
function openCreateUserModal() {
  // Limpar formulário
  document.getElementById("createUserForm").reset();
  document.getElementById("forcePasswordChange").checked = true;

  // Abrir modal
  const modal = new bootstrap.Modal(document.getElementById("createUserModal"));
  modal.show();
}

// Gerar senha aleatória
function generateRandomPassword() {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*";
  let password = "";
  for (let i = 0; i < 12; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  document.getElementById("modalPassword").value = password;
}

// Criar usuário a partir do modal
async function createUserFromModal() {
  try {
    const username = document.getElementById("modalUsername").value.trim();
    const password = document.getElementById("modalPassword").value.trim();
    const role = document.getElementById("modalRole").value;
    const forcePasswordChange = document.getElementById(
      "forcePasswordChange"
    ).checked;

    // Validações
    if (username.length < 3) {
      showToast("Usuário deve ter pelo menos 3 caracteres", "error");
      return;
    }
    if (password.length < 6) {
      showToast("Senha deve ter pelo menos 6 caracteres", "error");
      return;
    }

    showToast("Criando usuário...", "info");
    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username,
        password,
        role,
        forcePasswordChange,
      }),
    });

    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || "Falha ao criar usuário");
    }

    const newUser = await res.json();

    // Fechar modal
    const modal = bootstrap.Modal.getInstance(
      document.getElementById("createUserModal")
    );
    modal.hide();

    showToast(`Usuário "${username}" criado com sucesso!`, "success");
    loadUsers();
  } catch (e) {
    console.error("Erro ao criar usuário:", e);
    showToast("Erro ao criar usuário: " + e.message, "error");
  }
}

// Abrir modal de configurações do usuário
async function openUserConfigModal(userId, username) {
  try {
    // Carregar configuração atual do usuário
    const res = await fetch(`/api/admin/users/${userId}/config`);
    if (res.ok) {
      const config = await res.json();
      document.getElementById("configApiUrl").value =
        config.evolutionApiUrl || "";
      document.getElementById("configToken").value = config.token || "";
      document.getElementById("configInstance").value =
        config.instanceName || "";
    } else {
      // Limpar campos se não há configuração
      document.getElementById("configApiUrl").value = "";
      document.getElementById("configToken").value = "";
      document.getElementById("configInstance").value = "";
    }

    // Configurar modal
    document.getElementById("configUserId").value = userId;
    document.getElementById("configUserName").textContent = username;

    // Abrir modal
    const modal = new bootstrap.Modal(
      document.getElementById("userConfigModal")
    );
    modal.show();
  } catch (e) {
    console.error("Erro ao carregar configuração:", e);
    showToast("Erro ao carregar configuração do usuário", "error");
  }
}

// Salvar configuração do usuário a partir do modal
async function saveUserConfigFromModal() {
  try {
    const userId = document.getElementById("configUserId").value;
    const evolutionApiUrl = document
      .getElementById("configApiUrl")
      .value.trim();
    const token = document.getElementById("configToken").value.trim();
    const instanceName = document.getElementById("configInstance").value.trim();

    if (!userId || !evolutionApiUrl || !token || !instanceName) {
      showToast("Todos os campos são obrigatórios", "error");
      return;
    }

    showToast("Salvando configuração...", "info");
    const res = await fetch(`/api/admin/users/${userId}/config`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ evolutionApiUrl, token, instanceName }),
    });

    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || "Falha ao salvar configuração");
    }

    // Fechar modal
    const modal = bootstrap.Modal.getInstance(
      document.getElementById("userConfigModal")
    );
    modal.hide();

    showToast("Configuração salva com sucesso!", "success");
  } catch (e) {
    console.error("Erro ao salvar configuração:", e);
    showToast("Erro ao salvar configuração: " + e.message, "error");
  }
}

// Testar conexão da Evolution API para o usuário
async function testUserConnection() {
  try {
    const userId = document.getElementById("configUserId").value;
    const evolutionApiUrl = document
      .getElementById("configApiUrl")
      .value.trim();
    const token = document.getElementById("configToken").value.trim();
    const instanceName = document.getElementById("configInstance").value.trim();

    if (!userId || !evolutionApiUrl || !token || !instanceName) {
      showToast("Preencha todos os campos antes de testar", "error");
      return;
    }

    showToast("Testando conexão...", "info");
    const res = await fetch(`/api/admin/users/${userId}/test-connection`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ evolutionApiUrl, token, instanceName }),
    });

    if (res.ok) {
      showToast("Conexão testada com sucesso!", "success");
    } else {
      const error = await res.json();
      throw new Error(error.error || "Falha na conexão");
    }
  } catch (e) {
    console.error("Erro ao testar conexão:", e);
    showToast("Erro ao testar conexão: " + e.message, "error");
  }
}

// Alternar visibilidade da senha
function togglePasswordVisibility(inputId) {
  const input = document.getElementById(inputId);
  const icon = document.getElementById(inputId + "Icon");

  if (input.type === "password") {
    input.type = "text";
    icon.classList.remove("fa-eye");
    icon.classList.add("fa-eye-slash");
  } else {
    input.type = "password";
    icon.classList.remove("fa-eye-slash");
    icon.classList.add("fa-eye");
  }
}

async function editUser(id, username, role) {
  const newRole = prompt(
    `Editar usuário "${username}"\n\nRole atual: ${role}\n\nDigite nova role (user/admin):`,
    role
  );
  if (!newRole || newRole === role) return;

  if (!["user", "admin"].includes(newRole)) {
    showToast("Role deve ser 'user' ou 'admin'", "error");
    return;
  }

  try {
    showToast("Atualizando usuário...", "info");
    const res = await fetch(`/api/admin/users/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: newRole }),
    });

    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || "Falha ao atualizar usuário");
    }

    showToast(
      `Usuário "${username}" atualizado para role: ${newRole}`,
      "success"
    );
    loadUsers();
  } catch (e) {
    console.error("Erro ao editar usuário:", e);
    showToast("Erro ao editar usuário: " + e.message, "error");
  }
}

async function resetUserPassword(id, username) {
  if (
    !confirm(
      `Deseja redefinir a senha do usuário "${username}"?\n\nUma nova senha aleatória será gerada e o usuário deverá alterá-la no próximo login.`
    )
  )
    return;

  try {
    showToast("Gerando nova senha...", "info");
    const res = await fetch(`/api/admin/users/${id}/password`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        generateRandom: true,
        forcePasswordChange: true,
      }),
    });

    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || "Falha ao redefinir senha");
    }

    const result = await res.json();

    // Mostrar a nova senha para o admin
    const newPassword = result.newPassword;
    const message = `Senha redefinida para "${username}"!\n\nNova senha: ${newPassword}\n\nO usuário deverá alterar esta senha no próximo login.`;

    if (
      confirm(
        message + "\n\nDeseja copiar a senha para a área de transferência?"
      )
    ) {
      navigator.clipboard
        .writeText(newPassword)
        .then(() => {
          showToast("Senha copiada para a área de transferência!", "success");
        })
        .catch(() => {
          showToast("Senha redefinida com sucesso!", "success");
        });
    } else {
      showToast("Senha redefinida com sucesso!", "success");
    }
  } catch (e) {
    console.error("Erro ao redefinir senha:", e);
    showToast("Erro ao redefinir senha: " + e.message, "error");
  }
}

async function deleteUser(id, username) {
  if (
    !confirm(
      `Deseja realmente excluir o usuário "${username}"?\n\nEsta ação não pode ser desfeita.`
    )
  )
    return;

  try {
    showToast("Excluindo usuário...", "info");
    const res = await fetch(`/api/admin/users/${id}`, { method: "DELETE" });

    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || "Falha ao excluir usuário");
    }

    showToast(`Usuário "${username}" excluído com sucesso!`, "success");
    loadUsers();
  } catch (e) {
    console.error("Erro ao excluir usuário:", e);
    showToast("Erro ao excluir usuário: " + e.message, "error");
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

// Variáveis para o seletor de conversas
let allChats = [];
let chatSelectorModal;
let currentPage = 1;
let hasMoreChats = true;

// Variáveis globais para filtros (apenas busca por texto)
let chatFilters = {
  searchTerm: "",
};

// Função para aplicar filtros aos chats
function applyChatFilters(chats) {
  let filteredChats = [...chats];

  // Filtrar por termo de busca
  if (chatFilters.searchTerm) {
    const searchTerm = chatFilters.searchTerm.toLowerCase();
    filteredChats = filteredChats.filter((chat) => {
      const name = (chat.name || "").toLowerCase();
      const id = (chat.id || "").toLowerCase();
      return name.includes(searchTerm) || id.includes(searchTerm);
    });
  }

  return filteredChats;
}

// Função para atualizar filtros
function updateChatFilters() {
  const searchInput = document.getElementById("chatSearchInput");
  if (searchInput) {
    chatFilters.searchTerm = searchInput.value;
  }

  // Recarregar chats com filtros aplicados
  if (allChats.length > 0) {
    const filteredChats = applyChatFilters(allChats);
    displayChats(filteredChats, hasMoreChats);
  }
}

// Função placeholder (filtros removidos)
function toggleFilter() {}

// Função para resetar filtros (apenas texto)
function resetChatFilters() {
  chatFilters = {
    searchTerm: "",
  };

  // Limpar campo de busca
  const searchInput = document.getElementById("chatSearchInput");
  if (searchInput) searchInput.value = "";

  // Recarregar chats
  if (allChats.length > 0) {
    const filteredChats = applyChatFilters(allChats);
    displayChats(filteredChats, hasMoreChats);
  }
}

// Função para abrir o seletor de conversas
function openChatSelector() {
  console.log("openChatSelector chamada");

  if (!chatSelectorModal) {
    chatSelectorModal = new bootstrap.Modal(
      document.getElementById("chatSelectorModal")
    );
  }

  // Resetar filtros e variáveis
  resetChatFilters();
  currentPage = 1;
  hasMoreChats = true;
  allChats = [];

  // Limpar lista
  const chatsList = document.getElementById("chatsList");
  chatsList.innerHTML = `
    <div class="text-center text-muted">
      <i class="fas fa-spinner fa-spin fa-2x mb-3"></i>
      <p>Carregando grupos...</p>
    </div>
  `;

  chatSelectorModal.show();
  loadChats();
}

// Função para carregar conversas da Evolution API
async function loadChats() {
  try {
    const chatsList = document.getElementById("chatsList");
    chatsList.innerHTML = `
      <div class="text-center text-muted">
        <i class="fas fa-spinner fa-spin fa-2x mb-3"></i>
        <p>Carregando grupos...</p>
      </div>
    `;

    // Primeiro limpar cache e verificar se a configuração está completa
    await fetch("/api/config/clear-cache");

    const configResponse = await fetch("/api/config/status");
    const configStatus = await configResponse.json();

    if (!configStatus.hasConfig) {
      throw new Error(
        "Configuração da Evolution API incompleta. Configure a API primeiro na seção Configuração."
      );
    }

    const response = await fetch(
      `/api/chats?page=${currentPage}&_t=${Date.now()}`,
      {
        headers: {
          "Cache-Control": "no-cache, no-store, must-revalidate",
          Pragma: "no-cache",
        },
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Erro ao carregar conversas");
    }

    const result = await response.json();

    // Cachear grupos: guardar no groupsMap
    if (result && Array.isArray(result.chats)) {
      const map = { ...groupsMap };
      result.chats.forEach((g) => {
        if (g && g.id && g.name) {
          map[g.id] = g.name;
        }
      });
      groupsMap = map;
    }

    // Como agora grupos vêm todos de uma vez, sempre substituir a lista
    allChats = result.chats;

    hasMoreChats = result.hasMore;
    currentPage = result.currentPage;

    displayChats(allChats, result.hasMore);
  } catch (error) {
    console.error("Erro ao carregar conversas:", error);
    const chatsList = document.getElementById("chatsList");

    let errorMessage = error.message;
    let showConfigButton = false;

    if (error.message.includes("Configuração da Evolution API incompleta")) {
      showConfigButton = true;
      errorMessage =
        "Configure a Evolution API primeiro para usar esta funcionalidade.";
    }

    chatsList.innerHTML = `
      <div class="text-center text-danger">
        <i class="fas fa-exclamation-triangle fa-2x mb-3"></i>
        <p>Erro ao carregar grupos</p>
        <small>${errorMessage}</small>
        <br><br>
        ${
          showConfigButton
            ? `<button class="btn btn-primary btn-sm me-2" onclick="showSection('config')">
            <i class="fas fa-cog me-1"></i>
            Ir para Configuração
          </button>`
            : ""
        }
        <button class="btn btn-outline-primary btn-sm me-2" onclick="reloadGroups()">
          <i class="fas fa-sync-alt me-1"></i>
          Tentar novamente
        </button>
        <button class="btn btn-outline-warning btn-sm" onclick="clearCacheAndRetry()">
          <i class="fas fa-broom me-1"></i>
          Limpar Cache
        </button>
      </div>
    `;
  }
}

// Função para exibir conversas
function displayChats(chats, hasMore = false) {
  const chatsList = document.getElementById("chatsList");

  // Aplicar filtros aos chats
  const filteredChats = applyChatFilters(chats);

  if (!filteredChats || filteredChats.length === 0) {
    chatsList.innerHTML = `
      <div class="text-center text-muted">
        <i class="fas fa-comments fa-3x mb-3"></i>
        <p>Nenhum grupo encontrado</p>
        <small>${
          chats.length > 0
            ? "Tente ajustar a busca"
            : "Verifique se sua instância está conectada"
        }</small>
      </div>
    `;
    return;
  }

  // Adicionar cabeçalho com contagem (somente grupos nesta UI)
  const groupsCount = filteredChats.length;
  const contactsCount = 0;

  const headerHtml = `
    <div class="alert alert-info mb-3">
      <i class="fas fa-info-circle me-2"></i>
      <strong>${filteredChats.length}</strong> grupos encontrados
    </div>
  `;

  const chatsHtml = filteredChats
    .map((chat) => {
      const isGroup =
        (chat.type && String(chat.type).toLowerCase() === "group") ||
        (chat.id && chat.id.includes("@g.us"));
      const chatName = chat.name || chat.id || "Conversa sem nome";
      const chatId = chat.id;

      // Informações adicionais se disponíveis
      const lastMessage = chat.lastMessage || "";
      const timestamp = chat.updatedAt
        ? new Date(chat.updatedAt).toLocaleString("pt-BR")
        : chat.timestamp
        ? new Date(chat.timestamp).toLocaleString("pt-BR")
        : "";

      const profilePic = chat.profilePicUrl
        ? `<img src="${chat.profilePicUrl}" class="rounded-circle me-3" width="40" height="40" alt="Foto de perfil">`
        : `<div class="me-3">
          <i class="fas ${
            isGroup ? "fa-users text-primary" : "fa-user text-success"
          } fa-lg"></i>
        </div>`;

      return `
      <div class="card mb-2 chat-item" data-chat-id="${chatId}" data-chat-name="${chatName}">
        <div class="card-body p-3">
          <div class="d-flex align-items-center">
            ${profilePic}
            <div class="flex-grow-1">
              <h6 class="mb-1">${chatName}</h6>
              <small class="text-muted">Grupo</small>
              ${
                lastMessage
                  ? `<br><small class="text-muted">${lastMessage.substring(
                      0,
                      50
                    )}${lastMessage.length > 50 ? "..." : ""}</small>`
                  : ""
              }
              
            </div>
            <div>
              <button 
                class="btn btn-primary btn-sm" 
                onclick="selectChat('${chatId}', '${chatName}', ${isGroup})"
                title="Selecionar esta conversa"
              >
                <i class="fas fa-check"></i>
                Selecionar
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
    })
    .join("");

  // Adicionar botão "Carregar mais" se houver mais páginas
  let loadMoreButton = "";
  if (hasMore) {
    loadMoreButton = `
      <div class="text-center mt-3">
        <button class="btn btn-outline-primary" onclick="loadMoreChats()">
          <i class="fas fa-plus me-2"></i>
          Carregar mais conversas
        </button>
      </div>
    `;
  }

  chatsList.innerHTML = headerHtml + chatsHtml + loadMoreButton;
}

// Função para filtrar conversas
function filterChats() {
  updateChatFilters();
}

// Botão de recarregar grupos no modal
function reloadGroups() {
  // limpar cache e recarregar
  groupsMap = {};
  currentPage = 1;
  hasMoreChats = true;
  allChats = [];
  // Forçar refresh no backend (ignorar cache server-side)
  loadChatsWithRefresh();
}

async function loadChatsWithRefresh() {
  try {
    const chatsList = document.getElementById("chatsList");
    chatsList.innerHTML = `
      <div class="text-center text-muted">
        <i class="fas fa-spinner fa-spin fa-2x mb-3"></i>
        <p>Carregando grupos...</p>
      </div>
    `;

    await fetch("/api/config/clear-cache");

    const response = await fetch(`/api/chats?refresh=true&_t=${Date.now()}`, {
      headers: {
        "Cache-Control": "no-cache, no-store, must-revalidate",
        Pragma: "no-cache",
      },
    });
    const result = await response.json();
    if (result && Array.isArray(result.chats)) {
      const map = { ...groupsMap };
      result.chats.forEach((g) => {
        if (g && g.id && g.name) {
          map[g.id] = g.name;
        }
      });
      groupsMap = map;
    }
    allChats = result.chats || [];
    hasMoreChats = false;
    currentPage = 1;
    displayChats(allChats, false);
  } catch (e) {
    // fallback
    loadChats();
  }
}

// Função para carregar mais conversas (desabilitada para grupos completos)
async function loadMoreChats() {
  if (!hasMoreChats) return;

  try {
    currentPage++;
    const response = await fetch(
      `/api/chats?page=${currentPage}&_t=${Date.now()}`,
      {
        headers: {
          "Cache-Control": "no-cache, no-store, must-revalidate",
          Pragma: "no-cache",
        },
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Erro ao carregar mais conversas");
    }

    const result = await response.json();

    // Adicionar novas conversas ao final
    allChats = allChats.concat(result.chats);
    hasMoreChats = result.hasMore;
    currentPage = result.currentPage;

    // Atualizar a exibição
    displayChats(allChats, result.hasMore);

    showToast(`${result.chats.length} conversas adicionadas!`, "success");
  } catch (error) {
    console.error("Erro ao carregar mais conversas:", error);
    showToast("Erro ao carregar mais conversas", "error");
    currentPage--; // Reverter a página em caso de erro
  }
}

// Função para limpar cache e tentar novamente
async function clearCacheAndRetry() {
  try {
    await fetch("/api/config/clear-cache");
    showToast("Cache limpo! Tentando carregar conversas...", "warning");
    await loadChats();
  } catch (error) {
    console.error("Erro ao limpar cache:", error);
    showToast("Erro ao limpar cache", "error");
  }
}

// Função para selecionar uma conversa
function selectChat(chatId, chatName, isGroupParam) {
  // Extrair o número do telefone do ID da conversa
  // Para conversas individuais: 5511999999999@s.whatsapp.net
  // Para grupos: o ID do grupo permanece como está
  let phoneNumber = chatId;

  const appearsGroup =
    (typeof isGroupParam !== "undefined" && !!isGroupParam) ||
    (chatId && chatId.includes("@g.us"));

  if (chatId && chatId.includes("@s.whatsapp.net")) {
    // É uma conversa individual, extrair o número
    phoneNumber = chatId.split("@")[0];
  } else if (appearsGroup) {
    // É um grupo, garantir sufixo @g.us
    phoneNumber =
      chatId && chatId.includes("@g.us") ? chatId : `${chatId}@g.us`;
  } else if (chatId && !chatId.includes("@")) {
    // Pode ser um número simples, usar como está
    phoneNumber = chatId;
  }

  // Preencher o campo de telefone
  document.getElementById("phone").value = phoneNumber;

  // Fechar o modal
  if (chatSelectorModal) {
    chatSelectorModal.hide();
  }

  // Mostrar toast de confirmação
  const typeText = appearsGroup ? "Grupo" : "Contato";
  showToast(`${typeText} selecionado: ${chatName}`, "success");
}

// Atualizar estatísticas do painel admin
function updateStats(users) {
  const totalUsers = users.length;
  const adminUsers = users.filter((u) => u.role === "admin").length;
  const activeUsers = totalUsers; // Por enquanto, todos os usuários são considerados ativos

  document.getElementById("totalUsers").textContent = totalUsers;
  document.getElementById("activeUsers").textContent = activeUsers;
  document.getElementById("adminUsers").textContent = adminUsers;

  // Carregar total de mensagens
  loadTotalMessages();
}

// Carregar total de mensagens agendadas
async function loadTotalMessages() {
  try {
    const res = await fetch("/api/admin/stats");
    if (res.ok) {
      const stats = await res.json();
      document.getElementById("totalMessages").textContent =
        stats.totalMessages || 0;
    }
  } catch (e) {
    console.error("Erro ao carregar estatísticas:", e);
    document.getElementById("totalMessages").textContent = "-";
  }
}
