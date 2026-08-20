/**
 * Servidor Backend Node.js / Express (Opcional para persistência em SQLite)
 */
const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, '..')));

app.get('/api/health', (req, res) => {
  res.json({ status: 'online', service: 'ArqVértice Cronograma API' });
});

app.listen(PORT, () => {
  console.log(`Servidor ArqVértice rodando na porta ${PORT}`);
});
