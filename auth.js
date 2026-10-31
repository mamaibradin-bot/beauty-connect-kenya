const jwt = require("jsonwebtoken");
const db = require("./db");
async function auth(req,res,next) {
  try {
    const h=req.headers.authorization||"";
    if(!h.startsWith("Bearer ")) return res.status(401).json({success:false,message:"Sign in required."});
    if(!process.env.JWT_SECRET || process.env.JWT_SECRET.length<32) return res.status(500).json({success:false,message:"Configure a JWT_SECRET of at least 32 characters."});
    const p=jwt.verify(h.slice(7),process.env.JWT_SECRET);
    const r=await db.query("SELECT id,name,email,phone,role FROM users WHERE id=$1",[p.sub]);
    if(!r.rowCount) return res.status(401).json({success:false,message:"Account not found."});
    req.user=r.rows[0]; next();
  } catch(e) { return res.status(401).json({success:false,message:"Invalid or expired token."}); }
}
const role=(...roles)=>(req,res,next)=>roles.includes(req.user?.role)?next():res.status(403).json({success:false,message:"Permission denied."});
module.exports={auth,role};
