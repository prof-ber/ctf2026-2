const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const { Client } = require("pg");
const bodyParser = require("body-parser");
const path = require("path");

const app = express();
// Memória para guardar os acessos por IP
const ipRequests = {};

// Middleware de Rate Limite "Feito em Casa"
const rateLimiter = (req, res, next) => {
  // Pega o IP de quem está fazendo a requisição
  const ip = req.ip || req.connection.remoteAddress;
  const currentTime = Date.now();
  const windowTime = 60 * 1000; // Janela de 1 minuto
  const maxRequests = 50; // Máximo de 50 requisições por minuto

  // Se o IP ainda não tem registro, cria um
  if (!ipRequests[ip]) {
    ipRequests[ip] = { count: 1, startTime: currentTime };
    return next();
  }

  
  if (currentTime - ipRequests[ip].startTime > windowTime) {
    ipRequests[ip] = { count: 1, startTime: currentTime };
    return next();
  }

  // Incrementa a contagem de requisições
  ipRequests[ip].count++;

  // Se passou do limite, corta a conexão com status 429 (Too Many Requests)
  if (ipRequests[ip].count > maxRequests) {
    console.log(`[DEFESA] IP Bloqueado por flood: ${ip}`);
    return res.status(429).json({ error: "Muitas requisições. Acalme-se e aguarde 1 minuto." });
  }

  next(); // Deixa a requisição passar se estiver tudo OK
};

// Aplica o escudo em TODAS as rotas
app.use(rateLimiter);
const server = http.createServer(app);
const io = socketIo(server);

// Armazenamento em memória para as sessões
const activeSessions = {};

// Middleware de CSP - Trava a execução de scripts maliciosos (XSS)
app.use((req, res, next) => {
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';"
  );
  next();
});

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static("public"));

// Conexão com o banco (Valores fixos devido à limitação do servidor)
const db = new Client({
  host: "localhost",
  user: "postgres",
  password: "password",
  database: "chat_app",
  port: 5432
});

db.connect((err) => {
  if (err) {
    console.error("Erro conectando ao banco:", err);
    return;
  }
  console.log("Conectado ao PostgreSQL");

  // Altera a senha do USUÁRIO admin na tabela do sistema
  const novaSenhaAdmin = "Senha_Forte_UTFPR_2026"; 
  const updateQuery = "UPDATE users SET password = $1 WHERE username = 'admin'";
  
  db.query(updateQuery, [novaSenhaAdmin], (err) => {
    if (err) {
      console.error("Erro ao alterar a senha do usuário admin:", err);
    } else {
      console.log("Senha do usuário admin atualizada com sucesso.");
    }
  });
});

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// LOGIN SEGURO - Criação manual de sessão baseada em Cookie
app.post("/api/login", (req, res) => {
  const { username, password } = req.body;

  const query = 'SELECT * FROM users WHERE username = $1 AND password = $2';
  
  db.query(query, [username, password], (err, result) => {
    if (err) {
      return res.status(500).json({ error: "Erro no banco de dados" });
    }

    if (result.rows && result.rows.length > 0) {
      const token = Math.random().toString(36).substring(2, 15);
      activeSessions[token] = result.rows[0].id;
      
      res.setHeader("Set-Cookie", `sessionId=${token}; HttpOnly; Path=/`);
      
      res.json({ success: true, user: result.rows[0] });
    } else {
      res.json({ success: false, message: "Credenciais inválidas" });
    }
  });
});

// BUSCA DE MENSAGENS SEGURA
app.get("/api/messages", (req, res) => {
  const search = req.query.search || "";

  let query = `SELECT m.message, u.username FROM messages m JOIN users u ON m.user_id = u.id`;
  let params = [];

  if (search) {
    query += ` WHERE m.message ILIKE $1`;
    params.push(`%${search}%`);
  }

  query += ` ORDER BY m.created_at DESC LIMIT 50`;

  db.query(query, params, (err, result) => {
    if (err) {
      return res.status(500).json({ error: "Erro no banco de dados" });
    }
    res.json(result.rows);
  });
});

// RECUPERAÇÃO DE FLAG - Validação manual do cookie de sessão
app.post("/api/getFlag", (req, res) => {
  const cookies = req.headers.cookie || "";
  const match = cookies.match(/sessionId=([^;]+)/);
  const token = match ? match[1] : null;

  if (!token || !activeSessions[token]) {
    return res.status(401).json({ error: "Acesso negado. Faça login primeiro." });
  }

  const { secret } = req.body;
  // Credencial fixada no código (Limitação de ambiente de laboratório)
  const adminSecret = "senha_segura_lab";

  if (secret === adminSecret) {
    const query = `SELECT * FROM flags WHERE flag_name = 'main_flag'`;

    db.query(query, (err, result) => {
      if (err || !result.rows || result.rows.length === 0) {
        return res.status(500).json({ error: "Erro ao buscar flag" });
      }
      res.json({ flag: result.rows[0].flag_value });
    });
  } else {
    res.status(401).json({ error: "Acesso negado" });
  }
});

// CHAT EM TEMPO REAL
io.on("connection", (socket) => {
  console.log("Usuário conectado:", socket.id);

  socket.on("chat message", (data) => {
    const query = 'INSERT INTO messages (user_id, message) VALUES ($1, $2)';

    db.query(query, [1, data.message], (err) => {
      if (err) {
        console.error("Erro ao salvar mensagem:", err);
        return;
      }

      io.emit("chat message", {
        username: "Usuário",
        message: data.message,
        timestamp: new Date().toLocaleTimeString(),
      });
    });
  });
  
  socket.on("disconnect", () => {
    console.log("Usuário desconectado:", socket.id);
  });
});

// Porta fixa
const PORT = 3000;
server.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});