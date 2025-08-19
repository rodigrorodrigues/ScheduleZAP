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

      // Usuário autenticado, verificar se precisa alterar senha
      const username = authStatus.user?.username || authStatus.username || "";
      const role = authStatus.user?.role || null;
      window.isAdmin = role === "admin" || username === "admin"; // Define variável global
      const forcePasswordChange = authStatus.user?.forcePasswordChange || false;

      const adminNav = document.getElementById("adminNav");
      console.log("Auth user:", {
        username,
        role,
        isAdmin,
        forcePasswordChange,
      });
      if (adminNav) {
        if (isAdmin) {
          adminNav.classList.remove("d-none");
        } else {
          adminNav.classList.add("d-none");
        }
      }
      updateUserInfo(username);
      toast = new bootstrap.Toast(document.getElementById("toast"));

      // Se precisa alterar senha, mostrar modal
      if (forcePasswordChange) {
        showChangePasswordModal();
      } else {
        // Carregar configuração global se for admin
        if (window.isAdmin) {
          loadGlobalConfig();
        }

        // Carregar status da instância
        loadInstanceStatus().then(async () => {
          // Verificar se tem instância conectada
          const instanceRes = await fetch("/api/instance");
          if (!instanceRes.ok) return;
          const instance = await instanceRes.json();

          // Se não tiver instância conectada, redirecionar para seção de instâncias
          if (!instance?.instance_connected) {
            showSection("instances");
          } else {
            // Se tiver instância conectada, carregar mensagens
            loadMessages();
          }
        });
      }

      // Event listeners
      document
        .getElementById("scheduleForm")
        .addEventListener("submit", handleScheduleSubmit);

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
async function showSection(section) {
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
  if (event?.target) {
    event.target.classList.add("active");
  } else {
    document
      .querySelector(`.nav-link[onclick*="showSection('${section}')"]`)
      ?.classList.add("active");
  }

  currentSection = section;

  // Se for seção de agendamento ou mensagens, verificar se tem instância conectada
  if (section === "schedule" || section === "scheduled") {
    const instanceRes = await fetch("/api/instance");
    if (!instanceRes.ok) return;
    const instance = await instanceRes.json();

    if (!instance?.instance_connected) {
      showToast("Conecte seu WhatsApp antes de agendar mensagens", "warning");
      showSection("instances");
      return;
    }
  }

  // Recarregar dados se necessário
  if (section === "scheduled") {
    loadMessages();
  } else if (section === "instances") {
    loadInstanceStatus();
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

    // Verificar se tem instância conectada
    const instanceRes = await fetch("/api/instance");
    if (!instanceRes.ok) {
      console.log("Falha ao verificar instância");
      return;
    }
    const instance = await instanceRes.json();
    if (!instance?.instance_connected) {
      console.log("Instância não conectada");
      return;
    }

    // Carregar grupos
    const res2 = await fetch(`/api/chats`);
    if (!res2.ok) {
      console.log("Erro ao carregar grupos:", res2.status);
      return;
    }

    const data = await res2.json();
    if (data && Array.isArray(data.chats)) {
      const map = {};
      data.chats.forEach((c) => {
        if (c && c.id && c.name) {
          map[c.id] = c.name;
        }
      });
      groupsMap = map;
      console.log(
        `Cache de grupos atualizado: ${Object.keys(map).length} grupos`
      );
    }
  } catch (e) {
    console.error("Erro ao carregar cache de grupos:", e);
    // Não mostrar erro para o usuário pois é apenas cache
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

    // Verificar se tem instância conectada
    const instanceRes = await fetch("/api/instance");
    if (!instanceRes.ok) throw new Error("Falha ao verificar instância");
    const instance = await instanceRes.json();

    const messagesList = document.getElementById("messagesList");

    if (!instance?.instance_connected) {
      messagesList.innerHTML = `
        <div class="text-center text-warning py-5">
          <i class="fas fa-exclamation-triangle fa-3x mb-3"></i>
          <h5>WhatsApp não conectado</h5>
          <p class="text-muted mb-4">
            Conecte seu WhatsApp para poder agendar mensagens.
          </p>
          <a href="#" onclick="showSection('instances')" class="btn btn-primary">
            <i class="fas fa-plug me-1"></i>
            Conectar WhatsApp
          </a>
        </div>
      `;
      return;
    }

    // Adicionar timestamp para evitar cache
    const response = await fetch("/api/messages", {
      method: "GET",
    });

    if (!response.ok) {
      console.error("Erro na resposta:", response.status, response.statusText);
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const messages = await response.json();
    // Garantir cache de grupos para exibir nomes no lugar do JID
    await loadGroupsCacheIfNeeded();
    console.log("Mensagens recebidas:", messages);

    if (messages.length === 0) {
      console.log("Nenhuma mensagem encontrada");
      messagesList.innerHTML = `
        <div class="text-center text-muted py-5">
          <i class="fas fa-inbox fa-3x mb-3"></i>
          <h5>Nenhuma mensagem agendada</h5>
          <p class="mb-4">
            Você ainda não tem nenhuma mensagem agendada.
          </p>
          <a href="#" onclick="showSection('schedule')" class="btn btn-primary">
            <i class="fas fa-calendar-plus me-1"></i>
            Agendar Nova Mensagem
          </a>
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
    // Verificar se há uma instância ativa
    const res = await fetch(`/api/instances/active`);
    if (!res.ok) {
      console.log("Nenhuma instância ativa encontrada");
      return;
    }

    const activeInstance = await res.json();
    if (!activeInstance) {
      console.log("Nenhuma instância ativa encontrada");
      return;
    }

    console.log("Instância ativa encontrada:", activeInstance.name);

    // Carregar grupos apenas se necessário
    const res2 = await fetch(`/api/chats`);

    if (!res2.ok) {
      console.log("Erro ao carregar grupos:", res2.status);
      return;
    }

    const data = await res2.json();
    if (data && Array.isArray(data.chats)) {
      const map = {};
      data.chats.forEach((c) => {
        if (c && c.id && c.name) {
          map[c.id] = c.name;
        }
      });
      groupsMap = map;
      console.log(
        `Cache de grupos atualizado: ${Object.keys(map).length} grupos`
      );
    }
  } catch (e) {
    console.error("Erro ao carregar cache de grupos:", e);
    // Não mostrar erro para o usuário pois é apenas cache
  }
}

// Handler para envio do formulário de agendamento
async function handleScheduleSubmit(event) {
  event.preventDefault();

  try {
    // Verificar se tem instância conectada
    const instanceRes = await fetch("/api/instance");
    if (!instanceRes.ok) throw new Error("Falha ao verificar instância");
    const instance = await instanceRes.json();

    if (!instance?.instance_connected) {
      showToast("Conecte seu WhatsApp antes de agendar mensagens", "error");
      showSection("instances");
      return;
    }

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

// Função handleConfigSubmit removida - configuração agora é por usuário via modais

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

  // Abrir modal
  const modal = new bootstrap.Modal(document.getElementById("createUserModal"));
  modal.show();
}

// Criar usuário a partir do modal
async function createUserFromModal() {
  try {
    const username = document.getElementById("modalUsername").value.trim();
    const role = document.getElementById("modalRole").value;

    // Validações
    if (username.length < 3) {
      showToast("Usuário deve ter pelo menos 3 caracteres", "error");
      return;
    }

    showToast("Criando usuário...", "info");
    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username,
        role,
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

    // Mostrar senha temporária
    console.log("Resposta do servidor:", newUser);
    if (newUser.temporaryPassword) {
      console.log("Senha temporária encontrada:", newUser.temporaryPassword);
      showToast(
        `Usuário "${username}" criado com sucesso! Senha temporária: ${newUser.temporaryPassword}`,
        "success"
      );

      // Mostrar modal com a senha temporária
      const passwordModal = new bootstrap.Modal(
        document.getElementById("temporaryPasswordModal")
      );

      const usernameElement = document.getElementById("tempPasswordUsername");
      const passwordElement = document.getElementById("tempPasswordValue");

      console.log("Elementos encontrados:", {
        usernameElement: !!usernameElement,
        passwordElement: !!passwordElement,
      });

      if (usernameElement) {
        usernameElement.textContent = username;
      }

      if (passwordElement) {
        passwordElement.value = newUser.temporaryPassword;
      }

      passwordModal.show();
    } else {
      console.log("Nenhuma senha temporária encontrada na resposta");
      showToast(`Usuário "${username}" criado com sucesso!`, "success");
    }

    loadUsers();
  } catch (e) {
    console.error("Erro ao criar usuário:", e);
    showToast("Erro ao criar usuário: " + e.message, "error");
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

// Função simplificada para filtrar grupos
function filterChats() {
  const searchTerm = document
    .getElementById("chatSearchInput")
    .value.toLowerCase();

  if (!allChats || allChats.length === 0) return;

  const filteredChats = allChats.filter(
    (chat) => chat.name && chat.name.toLowerCase().includes(searchTerm)
  );

  displayChats(filteredChats);
}

// Função para abrir o seletor de conversas
function openChatSelector() {
  console.log("openChatSelector chamada");

  if (!chatSelectorModal) {
    chatSelectorModal = new bootstrap.Modal(
      document.getElementById("chatSelectorModal")
    );
  }

  // Limpar campo de busca
  const searchInput = document.getElementById("chatSearchInput");
  if (searchInput) searchInput.value = "";

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

// Carregar conversas/grupos
async function loadChats() {
  try {
    const chatsList = document.getElementById("chatsList");
    chatsList.innerHTML = `
      <div class="text-center text-muted">
        <i class="fas fa-spinner fa-spin fa-2x mb-3"></i>
        <p>Carregando grupos...</p>
      </div>
    `;

    // Verificar se tem instância conectada
    const instanceRes = await fetch("/api/instance");
    if (!instanceRes.ok) throw new Error("Falha ao verificar instância");
    const instance = await instanceRes.json();

    if (!instance?.instance_connected) {
      chatsList.innerHTML = `
        <div class="text-center text-warning py-5">
          <i class="fas fa-exclamation-triangle fa-3x mb-3"></i>
          <h5>WhatsApp não conectado</h5>
          <p class="text-muted mb-4">
            Conecte seu WhatsApp para poder selecionar grupos.
          </p>
          <a href="#" onclick="showSection('instances')" class="btn btn-primary">
            <i class="fas fa-plug me-1"></i>
            Conectar WhatsApp
          </a>
        </div>
      `;
      return;
    }

    const res = await fetch(`/api/chats`);
    if (!res.ok) {
      throw new Error(`Erro ${res.status}: ${res.statusText}`);
    }

    const data = await res.json();
    if (!data.success) {
      throw new Error(data.error || "Erro desconhecido");
    }

    const chats = data.chats || [];

    // Atualizar cache de grupos para exibição nas mensagens
    const map = {};
    chats.forEach((c) => {
      if (c && c.id && c.name) {
        map[c.id] = c.name;
      }
    });
    groupsMap = map;

    // Atualizar variável global para pesquisa
    allChats = chats;

    displayChats(chats);
  } catch (e) {
    console.error("Erro ao carregar grupos:", e);
    const chatsList = document.getElementById("chatsList");

    let errorMessage = e.message;
    if (e.message.includes("timeout") || e.message.includes("Timeout")) {
      errorMessage =
        "O WhatsApp está demorando para responder. Tente novamente em alguns instantes.";
    } else if (
      e.message.includes("ECONNREFUSED") ||
      e.message.includes("ENOTFOUND")
    ) {
      errorMessage =
        "Não foi possível conectar ao WhatsApp. Verifique sua conexão.";
    } else if (e.message.includes("401")) {
      errorMessage = "Erro de autenticação. Tente reconectar seu WhatsApp.";
    } else if (e.message.includes("404")) {
      errorMessage = "WhatsApp não encontrado. Tente reconectar.";
    }

    chatsList.innerHTML = `
      <div class="text-center text-danger py-5">
        <i class="fas fa-exclamation-triangle fa-3x mb-3"></i>
        <h5>Erro ao carregar grupos</h5>
        <p class="text-danger mb-4">${errorMessage}</p>
        <button class="btn btn-primary" onclick="loadChats()">
          <i class="fas fa-sync-alt me-1"></i>
          Tentar Novamente
        </button>
      </div>
    `;
  }
}

// Exibir conversas/grupos
function displayChats(chats) {
  const chatsList = document.getElementById("chatsList");

  if (!chats || chats.length === 0) {
    chatsList.innerHTML = `
      <div class="text-center text-muted py-5">
        <i class="fas fa-users fa-3x mb-3"></i>
        <h5>Nenhum grupo encontrado</h5>
        <p class="mb-4">
          Você precisa ser administrador de pelo menos um grupo no WhatsApp.
        </p>
        <a href="https://faq.whatsapp.com/android/groups/how-to-create-and-manage-groups" target="_blank" class="btn btn-outline-primary">
          <i class="fas fa-question-circle me-1"></i>
          Como criar grupos?
        </a>
      </div>
    `;
    return;
  }

  const chatItems = chats
    .map(
      (chat) => `
        <div class="chat-item card mb-3 cursor-pointer" onclick="selectChat('${
          chat.id
        }', '${chat.name}')">
          <div class="card-body">
            <div class="d-flex align-items-center">
              <div class="flex-shrink-0 me-3">
                <div class="chat-avatar bg-primary text-white rounded-circle d-flex align-items-center justify-content-center" style="width: 50px; height: 50px;">
                  <i class="fas fa-users"></i>
                </div>
              </div>
              <div class="flex-grow-1">
                <h6 class="mb-1">${chat.name}</h6>
                <small class="text-muted">
                  <i class="fas fa-users me-1"></i>
                  Grupo
                  ${chat.size ? ` • ${chat.size} membros` : ""}
                </small>
              </div>
              <div class="flex-shrink-0">
                <button class="btn btn-primary btn-sm">
                  <i class="fas fa-check me-1"></i>
                  Selecionar
                </button>
              </div>
            </div>
          </div>
        </div>
      `
    )
    .join("");

  chatsList.innerHTML = `
    <div class="mb-3">
      <h6 class="text-muted">
        <i class="fas fa-users me-2"></i>
        ${chats.length} grupos encontrados
      </h6>
    </div>
    ${chatItems}
  `;
}

// Função para selecionar uma conversa
function selectChat(chatId, chatName) {
  // Para grupos, garantir sufixo @g.us
  let phoneNumber = chatId;
  if (chatId && chatId.includes("@g.us")) {
    phoneNumber = chatId;
  } else if (chatId && !chatId.includes("@")) {
    phoneNumber = `${chatId}@g.us`;
  }

  // Preencher o campo de telefone
  document.getElementById("phone").value = phoneNumber;

  // Fechar o modal
  if (chatSelectorModal) {
    chatSelectorModal.hide();
  }

  // Mostrar toast de confirmação
  showToast(`Grupo "${chatName}" selecionado com sucesso!`, "success");

  // Focar no campo de mensagem
  document.getElementById("message").focus();
}

// Função para recarregar grupos
function reloadGroups() {
  groupsMap = {}; // Limpar cache
  loadChats();
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

// Função para mostrar modal de alteração de senha
function showChangePasswordModal() {
  const modal = new bootstrap.Modal(
    document.getElementById("changePasswordModal")
  );
  modal.show();
}

// Função para alterar senha do modal obrigatório
async function changePasswordFromModal() {
  try {
    const newPassword = document.getElementById("newPassword").value.trim();
    const confirmPassword = document
      .getElementById("confirmPassword")
      .value.trim();

    // Validações
    if (newPassword.length < 6) {
      showToast("Nova senha deve ter pelo menos 6 caracteres", "error");
      return;
    }

    if (newPassword !== confirmPassword) {
      showToast("As senhas não coincidem", "error");
      return;
    }

    showToast("Alterando senha...", "info");

    const res = await fetch("/api/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        currentPassword: "", // Não precisamos da senha atual para usuários com forcePasswordChange
        newPassword: newPassword,
      }),
    });

    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || "Falha ao alterar senha");
    }

    // Fechar modal
    const modal = bootstrap.Modal.getInstance(
      document.getElementById("changePasswordModal")
    );
    modal.hide();

    showToast("Senha alterada com sucesso!", "success");

    // Inicializar aplicação após alteração de senha
    loadConfig();
    loadMessages();
  } catch (e) {
    console.error("Erro ao alterar senha:", e);
    showToast("Erro ao alterar senha: " + e.message, "error");
  }
}

// Função para copiar texto para a área de transferência
function copyToClipboard(elementId) {
  const element = document.getElementById(elementId);
  if (element) {
    element.select();
    element.setSelectionRange(0, 99999); // Para dispositivos móveis
    document.execCommand("copy");
    showToast("Senha copiada para a área de transferência!", "success");
  }
}

// Funções para gerenciar configuração global
async function loadGlobalConfig() {
  try {
    // Mostrar loading
    document.getElementById("evolutionApiUrl").disabled = true;
    document.getElementById("evolutionApiToken").disabled = true;
    document.getElementById("evolutionApiUrl").placeholder = "Carregando...";
    document.getElementById("evolutionApiToken").placeholder = "Carregando...";

    const res = await fetch("/api/admin/config");
    if (!res.ok) throw new Error("Falha ao carregar configuração");
    const config = await res.json();

    // Habilitar campos
    document.getElementById("evolutionApiUrl").disabled = false;
    document.getElementById("evolutionApiToken").disabled = false;
    document.getElementById("evolutionApiUrl").placeholder =
      "http://localhost:8080";
    document.getElementById("evolutionApiToken").placeholder = "Sua API Key";

    if (config) {
      document.getElementById("evolutionApiUrl").value =
        config.evolution_api_url || "";
      document.getElementById("evolutionApiToken").value =
        config.evolution_api_token || "";

      // Testar conexão automaticamente
      if (config.evolution_api_url && config.evolution_api_token) {
        testGlobalConfig();
      }
    }
  } catch (e) {
    console.error("Erro ao carregar configuração global:", e);
    showToast("Erro ao carregar configuração: " + e.message, "error");

    // Habilitar campos
    document.getElementById("evolutionApiUrl").disabled = false;
    document.getElementById("evolutionApiToken").disabled = false;
    document.getElementById("evolutionApiUrl").placeholder =
      "http://localhost:8080";
    document.getElementById("evolutionApiToken").placeholder = "Sua API Key";
  }
}

async function testGlobalConfig() {
  try {
    const evolutionApiUrl = document
      .getElementById("evolutionApiUrl")
      .value.trim();
    const evolutionApiToken = document
      .getElementById("evolutionApiToken")
      .value.trim();

    if (!evolutionApiUrl || !evolutionApiToken) {
      showToast("Preencha todos os campos antes de testar", "error");
      return;
    }

    // Desabilitar botões
    const testButton = document.querySelector(
      'button[onclick="testGlobalConfig()"]'
    );
    const saveButton = document.querySelector(
      'button[onclick="saveGlobalConfig()"]'
    );
    testButton.disabled = true;
    saveButton.disabled = true;
    testButton.innerHTML =
      '<i class="fas fa-spinner fa-spin me-1"></i> Testando...';

    showToast("Testando conexão com a Evolution API...", "info");

    const res = await fetch("/api/admin/config/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        evolution_api_url: evolutionApiUrl,
        evolution_api_token: evolutionApiToken,
      }),
    });

    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || "Falha ao testar conexão");
    }

    const result = await res.json();
    if (result.success) {
      showToast(
        `Conexão testada com sucesso! ${result.message || ""}`,
        "success"
      );
    } else {
      throw new Error(result.error || "Falha ao testar conexão");
    }

    // Habilitar botões
    testButton.disabled = false;
    saveButton.disabled = false;
    testButton.innerHTML = '<i class="fas fa-wifi me-1"></i> Testar Conexão';
  } catch (e) {
    console.error("Erro ao testar conexão:", e);
    showToast("Erro ao testar conexão: " + e.message, "error");

    // Habilitar botões
    const testButton = document.querySelector(
      'button[onclick="testGlobalConfig()"]'
    );
    const saveButton = document.querySelector(
      'button[onclick="saveGlobalConfig()"]'
    );
    testButton.disabled = false;
    saveButton.disabled = false;
    testButton.innerHTML = '<i class="fas fa-wifi me-1"></i> Testar Conexão';
  }
}

async function saveGlobalConfig() {
  try {
    const evolutionApiUrl = document
      .getElementById("evolutionApiUrl")
      .value.trim();
    const evolutionApiToken = document
      .getElementById("evolutionApiToken")
      .value.trim();

    if (!evolutionApiUrl || !evolutionApiToken) {
      showToast("Todos os campos são obrigatórios", "error");
      return;
    }

    // Desabilitar botões e campos
    const testButton = document.querySelector(
      'button[onclick="testGlobalConfig()"]'
    );
    const saveButton = document.querySelector(
      'button[onclick="saveGlobalConfig()"]'
    );
    const urlInput = document.getElementById("evolutionApiUrl");
    const tokenInput = document.getElementById("evolutionApiToken");

    testButton.disabled = true;
    saveButton.disabled = true;
    urlInput.disabled = true;
    tokenInput.disabled = true;
    saveButton.innerHTML =
      '<i class="fas fa-spinner fa-spin me-1"></i> Salvando...';

    showToast("Salvando configuração...", "info");

    const res = await fetch("/api/admin/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        evolution_api_url: evolutionApiUrl,
        evolution_api_token: evolutionApiToken,
      }),
    });

    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || "Falha ao salvar configuração");
    }

    showToast("Configuração salva com sucesso!", "success");

    // Habilitar botões e campos
    testButton.disabled = false;
    saveButton.disabled = false;
    urlInput.disabled = false;
    tokenInput.disabled = false;
    saveButton.innerHTML =
      '<i class="fas fa-save me-1"></i> Salvar Configuração';

    // Testar conexão automaticamente
    testGlobalConfig();
  } catch (e) {
    console.error("Erro ao salvar configuração:", e);
    showToast("Erro ao salvar configuração: " + e.message, "error");

    // Habilitar botões e campos
    const testButton = document.querySelector(
      'button[onclick="testGlobalConfig()"]'
    );
    const saveButton = document.querySelector(
      'button[onclick="saveGlobalConfig()"]'
    );
    const urlInput = document.getElementById("evolutionApiUrl");
    const tokenInput = document.getElementById("evolutionApiToken");

    testButton.disabled = false;
    saveButton.disabled = false;
    urlInput.disabled = false;
    tokenInput.disabled = false;
    saveButton.innerHTML =
      '<i class="fas fa-save me-1"></i> Salvar Configuração';
  }
}

// Funções para gerenciar instância do usuário
async function loadInstanceStatus() {
  try {
    // Verificar se tem configuração global (se for admin)
    if (window.isAdmin) {
      const configRes = await fetch("/api/admin/config");
      if (!configRes.ok) {
        document.getElementById("noInstance").style.display = "block";
        document.getElementById("noInstance").innerHTML = `
          <div class="text-center text-warning py-5">
            <i class="fas fa-exclamation-triangle fa-3x mb-3"></i>
            <h5>Configuração Necessária</h5>
            <p class="text-muted mb-4">
              Configure a Evolution API antes de conectar instâncias.
            </p>
            <button class="btn btn-primary" onclick="showSection('admin')">
              <i class="fas fa-cog me-1"></i>
              Configurar Evolution API
            </button>
          </div>
        `;
        return;
      }

      const config = await configRes.json();
      if (!config?.evolution_api_url || !config?.evolution_api_token) {
        document.getElementById("noInstance").style.display = "block";
        document.getElementById("noInstance").innerHTML = `
          <div class="text-center text-warning py-5">
            <i class="fas fa-exclamation-triangle fa-3x mb-3"></i>
            <h5>Configuração Necessária</h5>
            <p class="text-muted mb-4">
              Configure a Evolution API antes de conectar instâncias.
            </p>
            <button class="btn btn-primary" onclick="showSection('admin')">
              <i class="fas fa-cog me-1"></i>
              Configurar Evolution API
            </button>
          </div>
        `;
        return;
      }
    }

    const res = await fetch("/api/instance");
    if (!res.ok) throw new Error("Falha ao carregar status da instância");
    const instance = await res.json();

    // Esconder todos os estados
    document.getElementById("noInstance").style.display = "none";
    document.getElementById("connecting").style.display = "none";
    document.getElementById("connected").style.display = "none";
    document.getElementById("error").style.display = "none";

    if (!instance?.instance_name) {
      // Sem instância
      document.getElementById("noInstance").style.display = "block";
      document.getElementById("noInstance").innerHTML = `
        <div class="text-center py-5">
          <i class="fas fa-plug text-muted fa-3x mb-3"></i>
          <h5>Conecte seu WhatsApp</h5>
          <p class="text-muted mb-4">
            Você ainda não tem uma instância do WhatsApp conectada.
            <br>
            Clique no botão abaixo para começar.
          </p>
          <button class="btn btn-primary" onclick="createInstance()">
            <i class="fas fa-qrcode me-1"></i>
            Conectar WhatsApp
          </button>
        </div>
      `;
    } else if (instance.instance_status === "qr_ready") {
      // QR Code disponível
      createInstance();
    } else if (instance.instance_connected) {
      // Conectado
      document.getElementById("connected").style.display = "block";
      document.getElementById("connected").innerHTML = `
        <div class="text-center py-5">
          <i class="fas fa-check-circle text-success fa-3x mb-3"></i>
          <h5>WhatsApp Conectado</h5>
          <p class="text-muted mb-4">
            Seu WhatsApp está conectado e pronto para uso.
            <br>
            Você já pode agendar mensagens.
          </p>
          <div class="d-flex justify-content-center gap-2">
            <button class="btn btn-outline-danger" onclick="disconnectInstance()">
              <i class="fas fa-power-off me-1"></i>
              Desconectar
            </button>
            <button class="btn btn-outline-primary" onclick="refreshStatus()">
              <i class="fas fa-sync-alt me-1"></i>
              Atualizar Status
            </button>
            <button class="btn btn-primary" onclick="showSection('schedule')">
              <i class="fas fa-calendar-plus me-1"></i>
              Agendar Mensagem
            </button>
          </div>
        </div>
      `;
    } else if (instance.instance_status === "connecting") {
      // Conectando
      document.getElementById("connecting").style.display = "block";
      document.getElementById("connecting").innerHTML = `
        <div class="text-center py-5">
          <i class="fas fa-spinner fa-spin fa-3x mb-3"></i>
          <h5>Conectando...</h5>
          <p class="text-muted">
            Aguarde enquanto configuramos sua instância.
            <br>
            Isso pode levar alguns segundos.
          </p>
          <div class="progress mb-3" style="height: 10px;">
            <div class="progress-bar progress-bar-striped progress-bar-animated" style="width: 100%"></div>
          </div>
        </div>
      `;
      // Verificar status a cada 5 segundos
      setTimeout(loadInstanceStatus, 5000);
    } else {
      // Erro
      document.getElementById("error").style.display = "block";
      document.getElementById("error").innerHTML = `
        <div class="text-center py-5">
          <i class="fas fa-exclamation-triangle text-danger fa-3x mb-3"></i>
          <h5>Erro na Conexão</h5>
          <p class="text-danger mb-4">
            Status: ${instance.instance_status || "Desconhecido"}
          </p>
          <button class="btn btn-primary" onclick="retryConnection()">
            <i class="fas fa-sync-alt me-1"></i>
            Tentar Novamente
          </button>
        </div>
      `;
    }
  } catch (e) {
    console.error("Erro ao carregar status da instância:", e);
    document.getElementById("error").style.display = "block";
    document.getElementById("error").innerHTML = `
      <div class="text-center py-5">
        <i class="fas fa-exclamation-triangle text-danger fa-3x mb-3"></i>
        <h5>Erro ao Carregar Status</h5>
        <p class="text-danger mb-4">${e.message}</p>
        <button class="btn btn-primary" onclick="retryConnection()">
          <i class="fas fa-sync-alt me-1"></i>
          Tentar Novamente
        </button>
      </div>
    `;
  }
}

async function createInstance() {
  try {
    // Mostrar estado conectando
    document.getElementById("noInstance").style.display = "none";
    document.getElementById("connecting").style.display = "block";
    document.getElementById("connecting").innerHTML = `
      <div class="text-center py-5">
        <i class="fas fa-spinner fa-spin fa-3x mb-3"></i>
        <h5>Criando Instância...</h5>
        <p class="text-muted">
          Aguarde enquanto configuramos seu WhatsApp.
          <br>
          Isso pode levar alguns segundos.
        </p>
        <div class="progress mb-3" style="height: 10px;">
          <div class="progress-bar progress-bar-striped progress-bar-animated" style="width: 100%"></div>
        </div>
      </div>
    `;

    showToast("Criando instância do WhatsApp...", "info");

    const res = await fetch("/api/instance/create", { method: "POST" });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(
        error.details || error.error || "Falha ao criar instância"
      );
    }

    const data = await res.json();
    if (!data.qrCode) {
      throw new Error("QR Code não disponível");
    }

    showToast("Instância criada com sucesso!", "success");

    // Aguardar um pouco para a instância ser criada
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Mostrar QR Code
    const modal = new bootstrap.Modal(document.getElementById("qrCodeModal"));
    modal.show();

    document.getElementById("qrCodeLoading").style.display = "none";
    document.getElementById("qrCodeDisplay").style.display = "block";
    document.getElementById("qrCodeDisplay").innerHTML = `
      <div class="text-center">
        <img src="${data.qrCode}" alt="QR Code" class="img-fluid mb-3" style="max-width: 300px;" />
        <h5>Escaneie o QR Code</h5>
        <p class="text-muted mb-4">
          1. Abra o WhatsApp no seu celular
          <br>
          2. Toque em Menu <i class="fas fa-ellipsis-v"></i> ou Configurações <i class="fas fa-cog"></i>
          <br>
          3. Selecione "WhatsApp Web"
          <br>
          4. Aponte a câmera para este QR Code
        </p>
        <div class="alert alert-warning">
          <i class="fas fa-clock me-2"></i>
          Este QR Code expira em 60 segundos
        </div>
      </div>
    `;

    // Iniciar verificação de status
    try {
      await checkConnectionStatus();
    } catch (error) {
      console.error("Erro ao verificar status inicial:", error);
      // Continua mesmo com erro no status inicial
    }
  } catch (e) {
    console.error("Erro ao criar instância:", e);
    document.getElementById("connecting").style.display = "none";
    document.getElementById("error").style.display = "block";
    document.getElementById("error").innerHTML = `
      <div class="text-center py-5">
        <i class="fas fa-exclamation-triangle text-danger fa-3x mb-3"></i>
        <h5>Erro ao Criar Instância</h5>
        <p class="text-danger mb-4">${e.message}</p>
        <button class="btn btn-primary" onclick="retryConnection()">
          <i class="fas fa-sync-alt me-1"></i>
          Tentar Novamente
        </button>
      </div>
    `;
    showToast("Erro ao criar instância: " + e.message, "error");
  }
}

async function checkConnectionStatus() {
  try {
    const res = await fetch("/api/instance");
    if (!res.ok) throw new Error("Falha ao verificar status");
    const data = await res.json();
    console.log("Dados da instância:", JSON.stringify(data, null, 2));

    if (data.instance_connected) {
      // Conectado com sucesso
      document.getElementById("qrCodeDisplay").style.display = "none";
      document.getElementById("qrCodeSuccess").style.display = "block";
      document.getElementById("qrCodeSuccess").innerHTML = `
        <div class="text-center">
          <i class="fas fa-check-circle text-success fa-3x mb-3"></i>
          <h5>WhatsApp Conectado!</h5>
          <p class="text-muted mb-4">
            Seu WhatsApp foi conectado com sucesso.
            <br>
            Você já pode começar a agendar mensagens.
          </p>
          <button class="btn btn-primary" onclick="showSection('schedule')">
            <i class="fas fa-calendar-plus me-1"></i>
            Agendar Mensagem
          </button>
        </div>
      `;

      showToast("WhatsApp conectado com sucesso!", "success");

      // Fechar modal após 2 segundos
      setTimeout(() => {
        const modal = bootstrap.Modal.getInstance(
          document.getElementById("qrCodeModal")
        );
        modal.hide();
        loadInstanceStatus(); // Atualizar status na tela principal
      }, 2000);
    } else if (
      !data.instance_status ||
      data.instance_status === "not_created"
    ) {
      // Instância não criada ainda, não fazer nada
      console.log("Instância ainda não criada");
      // Se o modal estiver aberto, continuar verificando
      const modal = document.getElementById("qrCodeModal");
      if (modal && modal.style.display === "block") {
        setTimeout(checkConnectionStatus, 3000);
      }
      return;
    } else if (
      data.instance_status === "qr_ready" ||
      data.instance_status === "created" ||
      data.instance_status === "connecting"
    ) {
      // Continuar verificando a cada 3 segundos
      setTimeout(checkConnectionStatus, 3000);
    } else if (
      data.instance_status === "waiting" ||
      data.instance_status === "pending"
    ) {
      // Mostrar estado conectando
      document.getElementById("qrCodeDisplay").style.display = "none";
      document.getElementById("qrCodeSuccess").style.display = "none";
      document.getElementById("qrCodeError").style.display = "none";
      document.getElementById("qrCodeLoading").style.display = "block";
      document.getElementById("qrCodeLoading").innerHTML = `
        <div class="text-center">
          <i class="fas fa-spinner fa-spin fa-3x mb-3"></i>
          <h5>Conectando...</h5>
          <p class="text-muted">
            Aguarde enquanto estabelecemos a conexão.
            <br>
            Isso pode levar alguns segundos.
          </p>
          <div class="progress mb-3" style="height: 10px;">
            <div class="progress-bar progress-bar-striped progress-bar-animated" style="width: 100%"></div>
          </div>
        </div>
      `;
      // Continuar verificando a cada 3 segundos
      setTimeout(checkConnectionStatus, 3000);
    } else {
      // Status desconhecido, continuar tentando
      console.log("Status desconhecido:", data.instance_status);
      setTimeout(checkConnectionStatus, 3000);
    }
  } catch (e) {
    console.error("Erro ao verificar status:", e);
    document.getElementById("qrCodeDisplay").style.display = "none";
    document.getElementById("qrCodeError").style.display = "block";
    document.getElementById("qrCodeError").innerHTML = `
      <div class="text-center">
        <i class="fas fa-exclamation-triangle text-danger fa-3x mb-3"></i>
        <h5>Erro ao Verificar Status</h5>
        <p class="text-danger mb-4">${e.message}</p>
        <button class="btn btn-primary" onclick="retryQrCode()">
          <i class="fas fa-sync-alt me-1"></i>
          Tentar Novamente
        </button>
      </div>
    `;
    showToast("Erro ao verificar status: " + e.message, "error");
  }
}

async function retryQrCode() {
  document.getElementById("qrCodeError").style.display = "none";
  createInstance();
}

async function retryConnection() {
  document.getElementById("error").style.display = "none";
  createInstance();
}

async function disconnectInstance() {
  if (
    !confirm(
      "Tem certeza que deseja desconectar seu WhatsApp?\n\nVocê precisará escanear o QR Code novamente para reconectar."
    )
  ) {
    return;
  }

  try {
    // Mostrar loading
    document.getElementById("connected").innerHTML = `
      <div class="text-center py-5">
        <i class="fas fa-spinner fa-spin fa-3x mb-3"></i>
        <h5>Desconectando...</h5>
        <p class="text-muted">
          Aguarde enquanto desconectamos seu WhatsApp.
          <br>
          Isso pode levar alguns segundos.
        </p>
        <div class="progress mb-3" style="height: 10px;">
          <div class="progress-bar progress-bar-striped progress-bar-animated" style="width: 100%"></div>
        </div>
      </div>
    `;

    showToast("Desconectando WhatsApp...", "info");

    const res = await fetch("/api/instance", { method: "DELETE" });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || "Falha ao desconectar instância");
    }

    showToast("WhatsApp desconectado com sucesso!", "success");

    // Aguardar um pouco antes de recarregar
    setTimeout(() => {
      loadInstanceStatus();
    }, 1000);
  } catch (e) {
    console.error("Erro ao desconectar instância:", e);
    showToast("Erro ao desconectar: " + e.message, "error");

    // Mostrar erro
    document.getElementById("connected").innerHTML = `
      <div class="text-center py-5">
        <i class="fas fa-exclamation-triangle text-danger fa-3x mb-3"></i>
        <h5>Erro ao Desconectar</h5>
        <p class="text-danger mb-4">${e.message}</p>
        <button class="btn btn-primary" onclick="retryConnection()">
          <i class="fas fa-sync-alt me-1"></i>
          Tentar Novamente
        </button>
      </div>
    `;
  }
}

async function refreshStatus() {
  try {
    // Mostrar loading
    const currentState = document.querySelector(
      "#instanceStatus > div[style*='block']"
    );
    if (currentState) {
      currentState.innerHTML = `
        <div class="text-center py-5">
          <i class="fas fa-spinner fa-spin fa-3x mb-3"></i>
          <h5>Atualizando Status...</h5>
          <p class="text-muted">
            Aguarde enquanto verificamos o status do WhatsApp.
            <br>
            Isso pode levar alguns segundos.
          </p>
          <div class="progress mb-3" style="height: 10px;">
            <div class="progress-bar progress-bar-striped progress-bar-animated" style="width: 100%"></div>
          </div>
        </div>
      `;
    }

    showToast("Atualizando status do WhatsApp...", "info");

    // Aguardar um pouco antes de recarregar
    setTimeout(() => {
      loadInstanceStatus();
    }, 1000);
  } catch (e) {
    console.error("Erro ao atualizar status:", e);
    showToast("Erro ao atualizar status: " + e.message, "error");

    // Mostrar erro
    const currentState = document.querySelector(
      "#instanceStatus > div[style*='block']"
    );
    if (currentState) {
      currentState.innerHTML = `
        <div class="text-center py-5">
          <i class="fas fa-exclamation-triangle text-danger fa-3x mb-3"></i>
          <h5>Erro ao Atualizar Status</h5>
          <p class="text-danger mb-4">${e.message}</p>
          <button class="btn btn-primary" onclick="retryConnection()">
            <i class="fas fa-sync-alt me-1"></i>
            Tentar Novamente
          </button>
        </div>
      `;
    }
  }
}

// Função para copiar texto para a área de transferência
