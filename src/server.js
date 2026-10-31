require("dotenv").config();
const app = require("./app");
const { pool } = require("./db");
const port = Number(process.env.PORT || 3000);
(async () => {
  try {
    await pool.query("SELECT 1");
    app.listen(port, () => console.log(`BeautyConnect API running at http://localhost:${port}`));
  } catch (e) {
    console.error("Database connection failed. Check PostgreSQL and DATABASE_URL in .env:", e.message);
    process.exit(1);
  }
})();
