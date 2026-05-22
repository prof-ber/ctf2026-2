const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const { Client } = require("pg");
const bodyParser = require("body-parser");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Armazenamento em memória para as sessões (Substitui o express-session)
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

// Conexão com o banco
const db = new Client({
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "postgres",
  password: process.env.DB_PASSWORD || "password",
  database: process.env.DB_NAME || "chat_app",
  port: 5432
});

db.connect((err) => {
  if (err) {
    console.error("Erro conectando ao banco:", err);
    return;
  }
  console.log("Conectado ao PostgreSQL");
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
      // Gera um token simples e salva na memória
      const token = Math.random().toString(36).substring(2, 15);
      activeSessions[token] = result.rows[0].id;
      
      // Envia o token como cookie HTTP-Only para o navegador do usuário
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
  // Lê os cookies enviados pelo navegador
  const cookies = req.headers.cookie || "";
  const match = cookies.match(/sessionId=([^;]+)/);
  const token = match ? match[1] : null;

  // Verifica se o token existe e é válido
  if (!token || !activeSessions[token]) {
    return res.status(401).json({ error: "Acesso negado. Faça login primeiro." });
  }

  const { secret } = req.body;
  const adminSecret = process.env.ADMIN_SECRET || "senha_do_admin_modificada";

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

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});