const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const { Client } = require("pg");
const bodyParser = require("body-parser");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static("public"));

// Mock database for testing (no database required)
const MOCK_MODE = true;
const mockData = {
  users: [{ id: 1, username: "admin", password: "admin123" }],
  messages: [{ message: "test message", username: "admin", created_at: new Date() }],
  flags: [{ flag_name: "main_flag", flag_value: "FLAG{sql_injection_found}" }]
};

let db;
if (!MOCK_MODE) {
  db = new Client({
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
  });
} else {
  console.log("✓ Running in MOCK MODE (no database required)");
}

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.post("/api/login", (req, res) => {
  const { username, password } = req.body;

  // Using prepared statement to prevent SQL injection
  const query = "SELECT * FROM users WHERE username = $1 AND password = $2";
  const params = [username, password];

  console.log("Query executada:", query, "with params:", params);
  
  if (MOCK_MODE) {
    const user = mockData.users.find(u => u.username === username && u.password === password);
    res.json(user ? { success: true, user } : { success: false, message: "Credenciais inválidas" });
  } else {
    db.query(query, params, (err, result) => {
      if (err) {
        return res.status(500).json({ error: "Erro no banco de dados" });
      }

      if (result.rows && result.rows.length > 0) {
        res.json({ success: true, user: result.rows[0] });
      } else {
        res.json({ success: false, message: "Credenciais inválidas" });
      }
    });
  }
});

app.get("/api/messages", (req, res) => {
  const search = req.query.search || "";

  // Using prepared statement to prevent SQL injection
  let query;
  let params = [];

  if (search) {
    query = "SELECT m.message, u.username FROM messages m JOIN users u ON m.user_id = u.id WHERE m.message LIKE $1 ORDER BY m.created_at DESC LIMIT 50";
    params = [`%${search}%`];
  } else {
    query = "SELECT m.message, u.username FROM messages m JOIN users u ON m.user_id = u.id ORDER BY m.created_at DESC LIMIT 50";
    params = [];
  }

  console.log("Query mensagens:", query, "with params:", params);

  if (MOCK_MODE) {
    let messages = mockData.messages;
    if (search) {
      messages = messages.filter(m => m.message.includes(search));
    }
    res.json(messages);
  } else {
    db.query(query, params, (err, result) => {
      if (err) {
        return res.status(500).json({ error: "Erro no banco de dados" });
      }
      res.json(result.rows);
    });
  }
});

app.post("/api/getFlag", (req, res) => {
  const { secret } = req.body;

  if (secret === "admin123") {
    // Using prepared statement to prevent SQL injection
    const query = "SELECT * FROM flags WHERE flag_name = $1";
    const params = ["main_flag"];

    if (MOCK_MODE) {
      const flag = mockData.flags.find(f => f.flag_name === "main_flag");
      res.json(flag ? { flag: flag.flag_value } : { error: "Erro ao buscar flag" });
    } else {
      db.query(query, params, (err, result) => {
        if (err || !result.rows || result.rows.length === 0) {
          return res.status(500).json({ error: "Erro ao buscar flag" });
        }
        res.json({ flag: result.rows[0].flag_value });
      });
    }
  } else {
    res.status(401).json({ error: "Acesso negado" });
  }
});

io.on("connection", (socket) => {
  console.log("Usuário conectado:", socket.id);

  socket.on("chat message", (data) => {
    // Using prepared statement to prevent SQL injection
    const query = "INSERT INTO messages (user_id, message) VALUES (1, $1)";
    const params = [data.message];

    if (!MOCK_MODE) {
      db.query(query, params, (err) => {
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
    } else {
      // In MOCK_MODE, just emit the message
      io.emit("chat message", {
        username: "Usuário",
        message: data.message,
        timestamp: new Date().toLocaleTimeString(),
      });
    }
  });

  socket.on("disconnect", () => {
    console.log("Usuário desconectado:", socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});