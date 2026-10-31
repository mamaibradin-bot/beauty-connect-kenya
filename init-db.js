require("dotenv").config();
const fs=require("fs"),path=require("path"),db=require("./db");
(async()=>{try{const sql=fs.readFileSync(path.join(__dirname,"../database/schema.sql"),"utf8");await db.query(sql);console.log("BeautyConnect database tables created.");}catch(e){console.error("Database setup failed:",e.message);process.exitCode=1;}finally{await db.pool.end();}})();
