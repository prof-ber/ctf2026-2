-- Criar banco de dados
CREATE DATABASE chat_app;

-- Para conectar ao banco no psql, descomente a linha abaixo:
\c chat_app

-- Tabela de usuários
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de mensagens
CREATE TABLE messages (
    id SERIAL PRIMARY KEY,
    user_id INT,
    message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Tabela com a flag
CREATE TABLE flags (
    id SERIAL PRIMARY KEY,
    flag_name VARCHAR(50),
    flag_value VARCHAR(255)
);

-- Inserir dados iniciais
INSERT INTO users (username, password) VALUES 
('admin', 'admin123'),
('usuario1', 'senha123'),
('teste', 'teste123');

INSERT INTO messages (user_id, message) VALUES 
(1, 'Bem-vindo ao chat!'),
(2, 'Olá pessoal!'),
(3, 'Como vocês estão?');

-- ALUNOS: NÃO MODIFICAR :)
INSERT INTO flags (flag_name, flag_value) VALUES 
('main_flag', 'Sapo Verde'),
('secret_flag', 'FLAG{b4nc0_d3_d4d0s_s3gur0}'),
('easter_egg', 'FLAG{p0stgr3s_3_m41s_l3g4l}'),
('hidden_token', 'FLAG{1nj3ct10n_m4st3r_99}');