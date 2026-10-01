const express = require("express");
const mysql = require("mysql2/promise");

const app = express();
app.use(express.json());
const PORT = process.env.APP_PORT || 3000;

const dbConfig = {
  host: process.env.DB_HOST || "db",
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || "employee_user",
  password: process.env.DB_PASSWORD || "change_me",
  database: process.env.DB_NAME || "employee_db"
};

let pool;

async function initDatabase() {
  pool = mysql.createPool({ ...dbConfig, waitForConnections: true, connectionLimit: 10 });
  await pool.query(`
    CREATE TABLE IF NOT EXISTS employees (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      role VARCHAR(100) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

app.get("/", (req, res) => res.json({ message: "Employee CI/CD application is running" }));

app.get("/health", async (req, res) => {
  try {
    await pool.query("SELECT 1");
    res.status(200).json({ status: "healthy" });
  } catch (error) {
    res.status(503).json({ status: "unhealthy", error: error.message });
  }
});

app.get("/employees", async (req, res) => {
  const [rows] = await pool.query("SELECT * FROM employees ORDER BY id DESC");
  res.json(rows);
});

app.post("/employees", async (req, res) => {
  const { name, role } = req.body;
  if (!name || !role) return res.status(400).json({ error: "name and role are required" });
  const [result] = await pool.query("INSERT INTO employees(name, role) VALUES (?, ?)", [name, role]);
  res.status(201).json({ id: result.insertId, name, role });
});

async function start() {
  try {
    await initDatabase();
    app.listen(PORT, "0.0.0.0", () => console.log(`Application listening on port ${PORT}`));
  } catch (error) {
    console.error("Startup failed:", error);
    process.exit(1);
  }
}
start();
