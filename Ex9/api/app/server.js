const express = require('express');
const mysql = require('mysql2/promise');

const app = express();
app.use(express.json());

const PORT = Number(process.env.PORT || 3000);

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
});

// Liveness checks only whether the API process can answer HTTP requests.
app.get('/livez', (_req, res) => {
  res.status(200).json({ status: 'alive' });
});

// Readiness also checks whether the API can communicate with MySQL.
app.get('/readyz', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.status(200).json({ status: 'ready' });
  } catch (err) {
    res.status(503).json({ status: 'not-ready', message: err.message });
  }
});

app.get('/api/persons', async (_req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, first_name, last_name, email, created_at FROM person ORDER BY id'
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/persons/:id', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, first_name, last_name, email, created_at FROM person WHERE id = ?',
      [req.params.id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: 'person not found' });
    }
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/persons', async (req, res) => {
  const { first_name, last_name, email } = req.body;
  if (!first_name || !last_name) {
    return res.status(400).json({ error: 'first_name and last_name are required' });
  }

  try {
    const [result] = await pool.query(
      'INSERT INTO person (first_name, last_name, email) VALUES (?, ?, ?)',
      [first_name, last_name, email || null]
    );
    res.status(201).json({ id: result.insertId, first_name, last_name, email: email || null });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/persons/:id', async (req, res) => {
  const { first_name, last_name, email } = req.body;
  if (!first_name || !last_name) {
    return res.status(400).json({ error: 'first_name and last_name are required' });
  }

  try {
    const [result] = await pool.query(
      'UPDATE person SET first_name = ?, last_name = ?, email = ? WHERE id = ?',
      [first_name, last_name, email || null, req.params.id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'person not found' });
    }
    res.json({ id: Number(req.params.id), first_name, last_name, email: email || null });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/persons/:id', async (req, res) => {
  try {
    const [result] = await pool.query('DELETE FROM person WHERE id = ?', [req.params.id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'person not found' });
    }
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`person-api listening on port ${PORT}`);
});
