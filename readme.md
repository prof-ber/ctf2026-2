# Exercício Blue Team - Aplicação Web Vulnerável

## Objetivo

Esta aplicação contém múltiplas vulnerabilidades de segurança. Sua missão é identificar e corrigir todas as vulnerabilidades antes que o Red Team consiga roubar a flag do banco de dados.

## Como Executar

1. Instale as dependências: `npm install`
2. Configure o banco MySQL executando o script `database.sql`
3. Inicie o servidor: `npm start`
4. Acesse: http://localhost:3000

## Tarefas do Blue Team

- [ ] Identificar todos os pontos de SQL Injection
- [ ] Identificar todos os pontos de XSS
- [ ] Implementar prepared statements para SQL
- [ ] Implementar sanitização de inputs/outputs
- [ ] Remover credenciais hardcoded
- [ ] Implementar autenticação segura
- [ ] Adicionar CSP (Content Security Policy)

Boa sorte!
