const { Pool } = require("pg");
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
pool.on("error", e => console.error("PostgreSQL pool error:", e.message));
module.exports = { query: (sql, values) => pool.query(sql, values), pool };
