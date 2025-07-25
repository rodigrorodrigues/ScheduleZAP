# ScheduleZAP

Agende e envie mensagens do WhatsApp automaticamente usando a Evolution API. O ScheduleZAP é uma solução web simples, com interface amigável, que permite configurar, agendar, visualizar e cancelar envios de mensagens para seus contatos, tudo de forma centralizada.

## Funcionalidades

- Login por senha
- Configuração fácil da Evolution API (URL, instância, token)
- Agendamento de mensagens para qualquer data/hora
- Listagem e cancelamento de agendamentos
- Processamento automático dos envios (mesmo com o navegador fechado)
- Interface responsiva e mobile-first

## Tecnologias

- **Frontend:** React 18, Vite, Tailwind CSS
- **Backend:** Node.js (Express)
- **API:** Integração Evolution API v2
- **Banco:** Arquivo JSON persistente (schedules.json)
- **Container:** Docker/Docker Compose

---

## Como rodar localmente (sem Docker)

1. **Clone o repositório:**
   ```sh
   git clone <repo-url>
   cd ScheduleZAP
   ```
2. **Instale as dependências do frontend:**
   ```sh
   npm install
   ```
3. **Instale as dependências do backend:**
   ```sh
   cd backend
   npm install
   cd ..
   ```
4. **Inicie ambos juntos:**
   ```sh
   npm run dev
   ```
   - Frontend: http://localhost:3000
   - Backend: http://localhost:8080/api/schedules

---

## Como rodar com Docker Compose

1. **Build e start:**
   ```sh
   docker-compose up --build -d
   ```
2. **Acesse:**
   - Frontend: [http://localhost:8988](http://localhost:8988)
   - API: [http://localhost:8999/api/schedules](http://localhost:8999/api/schedules)
3. **Parar:**
   ```sh
   docker-compose down
   ```

O arquivo de agendamentos (`schedules.json`) é persistido no host.

---

## Configuração da Evolution API

1. Acesse a tela de configurações no menu.
2. Preencha:
   - **URL da API** (ex: https://evo.seusite.dev.br)
   - **Nome da instância**
   - **Token de autenticação**
3. Salve e teste a conexão.
4. Após conectar, agende mensagens normalmente.

---

## Observações

- O backend processa e envia as mensagens mesmo se o frontend estiver fechado.
- O frontend se comunica com o backend na porta 8999.
- O backend serve o frontend na porta 8988.
- O arquivo `schedules.json` é salvo e persistido automaticamente.

---
