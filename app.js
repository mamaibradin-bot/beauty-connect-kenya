const express=require("express"), cors=require("cors"), helmet=require("helmet"), rateLimit=require("express-rate-limit");
const bcrypt=require("bcryptjs"), jwt=require("jsonwebtoken");
const db=require("./db"), {auth,role}=require("./auth");
const app=express();
const path=require("path");
app.use(helmet());
app.use(cors({origin:process.env.FRONTEND_ORIGIN?process.env.FRONTEND_ORIGIN.split(","):true}));
app.use(express.json({limit:"1mb"}));
app.use(express.static(path.join(__dirname, "../public")));
app.use(rateLimit({windowMs:15*60*1000,limit:250}));
app.get("/",(q,s)=>s.json({name:"BeautyConnect API",message:"Beauty, Grooming and Wellness for Everyone."}));
app.get("/api/health",(q,s)=>s.json({success:true,message:"BeautyConnect API is running."}));

app.post("/api/auth/register",async(q,s)=>{
 try {
  const {name,email,password,phone,role:r="customer"}=q.body||{};
  if(typeof name!=="string"||name.trim().length<2||!/^\S+@\S+\.\S+$/.test(email||"")||typeof password!=="string"||password.length<10||!["customer","professional"].includes(r)) return s.status(400).json({success:false,message:"Provide name, valid email, password (10+ characters), and customer or professional role."});
  const hash=await bcrypt.hash(password,12);
  const out=await db.query("INSERT INTO users(name,email,password_hash,phone,role) VALUES($1,$2,$3,$4,$5) RETURNING id,name,email,phone,role,created_at",[name.trim(),email.toLowerCase(),hash,phone||null,r]);
  return s.status(201).json({success:true,user:out.rows[0],message:"Account created. Professional registration is free for now."});
 } catch(e) { if(e.code==="23505") return s.status(409).json({success:false,message:"Email already registered."}); throw e; }
});
app.post("/api/auth/login",async(q,s)=>{
 const {email,password}=q.body||{};
 const r=await db.query("SELECT * FROM users WHERE email=$1",[String(email||"").toLowerCase()]);
 if(!r.rowCount||!await bcrypt.compare(password||"",r.rows[0].password_hash)) return s.status(401).json({success:false,message:"Email or password incorrect."});
 if(!process.env.JWT_SECRET||process.env.JWT_SECRET.length<32) return s.status(500).json({success:false,message:"Configure a strong JWT_SECRET in .env."});
 const u=r.rows[0],token=jwt.sign({sub:u.id},process.env.JWT_SECRET,{expiresIn:process.env.JWT_EXPIRES_IN||"1d"});
 s.json({success:true,token,user:{id:u.id,name:u.name,email:u.email,phone:u.phone,role:u.role}});
});
app.get("/api/auth/me",auth,(q,s)=>s.json({success:true,user:q.user}));

app.get("/api/providers",async(q,s)=>{
 const r=await db.query("SELECT p.*,u.name AS owner_name FROM provider_profiles p JOIN users u ON u.id=p.user_id WHERE ($1::text IS NULL OR p.location ILIKE '%'||$1||'%') ORDER BY p.created_at DESC",[q.query.location||null]);
 s.json({success:true,providers:r.rows});
});
app.post("/api/providers/profile",auth,async(q,s)=>{
 if(q.user.role!=="professional") return s.status(403).json({success:false,message:"Professional account required."});
 const {business_name,bio,location}=q.body||{};
 if(typeof business_name!=="string"||business_name.trim().length<2) return s.status(400).json({success:false,message:"Business name is required."});
 const r=await db.query("INSERT INTO provider_profiles(user_id,business_name,bio,location) VALUES($1,$2,$3,$4) ON CONFLICT(user_id) DO UPDATE SET business_name=EXCLUDED.business_name,bio=EXCLUDED.bio,location=EXCLUDED.location,updated_at=NOW() RETURNING *",[q.user.id,business_name.trim(),bio||null,location||null]);
 s.status(201).json({success:true,provider:r.rows[0]});
});
app.get("/api/services",async(q,s)=>{
 const r=await db.query("SELECT s.*,p.business_name,p.location FROM services s JOIN provider_profiles p ON p.id=s.provider_id WHERE s.active=true AND ($1::text IS NULL OR s.category=$1)",[q.query.category||null]);
 s.json({success:true,services:r.rows});
});
app.post("/api/services",auth,async(q,s)=>{
 if(q.user.role!=="professional") return s.status(403).json({success:false,message:"Professional account required."});
 const {name,category,description,price_kes,duration_minutes}=q.body||{};
 if(!name||!category||!Number.isFinite(Number(price_kes))||Number(price_kes)<=0||!Number.isInteger(Number(duration_minutes))||Number(duration_minutes)<=0) return s.status(400).json({success:false,message:"Valid name, category, price and duration required."});
 const p=await db.query("SELECT id FROM provider_profiles WHERE user_id=$1",[q.user.id]);
 if(!p.rowCount) return s.status(400).json({success:false,message:"Create your professional profile first."});
 const r=await db.query("INSERT INTO services(provider_id,name,category,description,price_kes,duration_minutes) VALUES($1,$2,$3,$4,$5,$6) RETURNING *",[p.rows[0].id,name,category,description||null,price_kes,duration_minutes]);
 s.status(201).json({success:true,service:r.rows[0]});
});
app.post("/api/bookings",auth,async(q,s)=>{
 const {service_id,scheduled_at,notes}=q.body||{};
 if(!service_id||!scheduled_at||isNaN(Date.parse(scheduled_at))||new Date(scheduled_at)<=new Date()) return s.status(400).json({success:false,message:"Valid service_id and future scheduled_at required."});
 const p=await db.query("SELECT id,provider_id,price_kes FROM services WHERE id=$1 AND active=true",[service_id]);
 if(!p.rowCount) return s.status(404).json({success:false,message:"Service not found."});
 const x=p.rows[0],r=await db.query("INSERT INTO bookings(customer_id,provider_id,service_id,scheduled_at,amount_kes,notes) VALUES($1,$2,$3,$4,$5,$6) RETURNING *",[q.user.id,x.provider_id,service_id,scheduled_at,x.price_kes,notes||null]);
 s.status(201).json({success:true,booking:r.rows[0]});
});
app.get("/api/bookings/mine",auth,async(q,s)=>{
 const r=await db.query("SELECT b.*,sv.name AS service_name,p.business_name FROM bookings b JOIN services sv ON sv.id=b.service_id JOIN provider_profiles p ON p.id=b.provider_id WHERE b.customer_id=$1 OR p.user_id=$1 ORDER BY b.scheduled_at DESC",[q.user.id]);
 s.json({success:true,bookings:r.rows});
});
app.patch("/api/bookings/:id/status",auth,async(q,s)=>{
 const b=await db.query("SELECT b.*,p.user_id AS provider_user_id FROM bookings b JOIN provider_profiles p ON p.id=b.provider_id WHERE b.id=$1",[q.params.id]);
 if(!b.rowCount) return s.status(404).json({success:false,message:"Booking not found."});
 const x=b.rows[0],st=q.body?.status;
 if(!["confirmed","completed","cancelled"].includes(st)) return s.status(400).json({success:false,message:"Invalid status."});
 if(![x.customer_id,x.provider_user_id].includes(q.user.id)&&q.user.role!=="admin") return s.status(403).json({success:false,message:"Permission denied."});
 const r=await db.query("UPDATE bookings SET status=$1,updated_at=NOW() WHERE id=$2 RETURNING *",[st,q.params.id]);s.json({success:true,booking:r.rows[0]});
});
app.post("/api/reviews",auth,async(q,s)=>{
 const {booking_id,rating,comment}=q.body||{};
 if(!booking_id||!Number.isInteger(rating)||rating<1||rating>5) return s.status(400).json({success:false,message:"booking_id and rating from 1 to 5 required."});
 const b=await db.query("SELECT * FROM bookings WHERE id=$1 AND customer_id=$2 AND status='completed'",[booking_id,q.user.id]);
 if(!b.rowCount) return s.status(400).json({success:false,message:"Only a customer of a completed booking can review it."});
 const r=await db.query("INSERT INTO reviews(booking_id,customer_id,provider_id,rating,comment) VALUES($1,$2,$3,$4,$5) RETURNING *",[booking_id,q.user.id,b.rows[0].provider_id,rating,comment||null]);
 s.status(201).json({success:true,review:r.rows[0]});
});
app.get("/api/community/posts",async(q,s)=>{
 const r=await db.query("SELECT p.*,u.name AS author_name FROM posts p JOIN users u ON u.id=p.user_id ORDER BY p.created_at DESC LIMIT 100");s.json({success:true,posts:r.rows});
});
app.post("/api/community/posts",auth,async(q,s)=>{
 const body=String(q.body?.body||"").trim();if(!body||body.length>3000)return s.status(400).json({success:false,message:"Post must be 1-3000 characters."});
 const r=await db.query("INSERT INTO posts(user_id,body) VALUES($1,$2) RETURNING *",[q.user.id,body]);s.status(201).json({success:true,post:r.rows[0]});
});
app.post("/api/messages",auth,async(q,s)=>{
 const {recipient_id,body}=q.body||{};if(!recipient_id||!body||String(body).trim().length>3000)return s.status(400).json({success:false,message:"Recipient and message required."});
 const r=await db.query("INSERT INTO messages(sender_id,recipient_id,body) VALUES($1,$2,$3) RETURNING *",[q.user.id,recipient_id,String(body).trim()]);s.status(201).json({success:true,message:r.rows[0]});
});
app.get("/api/messages/:userId",auth,async(q,s)=>{
 const r=await db.query("SELECT * FROM messages WHERE (sender_id=$1 AND recipient_id=$2) OR (sender_id=$2 AND recipient_id=$1) ORDER BY created_at",[q.user.id,q.params.userId]);s.json({success:true,messages:r.rows});
});

// Pending payment ledger only: no actual collection or payout occurs in this starter.
app.post("/api/payments/initialize",auth,async(q,s)=>{
 const b=await db.query("SELECT * FROM bookings WHERE id=$1 AND customer_id=$2",[q.body?.booking_id,q.user.id]);
 if(!b.rowCount)return s.status(404).json({success:false,message:"Booking not found."});
 const x=b.rows[0],r=await db.query("INSERT INTO payments(booking_id,customer_id,provider_id,amount_kes,commission_kes,professional_amount_kes,status) VALUES($1,$2,$3,$4,ROUND($4*0.10,2),ROUND($4*0.90,2),'pending') RETURNING *",[x.id,x.customer_id,x.provider_id,x.amount_kes]);
 s.status(201).json({success:true,payment:r.rows[0],message:"Pending ledger record only; no money has been collected or paid out."});
});
app.get("/api/admin/overview",auth,role("admin"),async(q,s)=>{
 const r=await db.query("SELECT (SELECT COUNT(*) FROM users)::int users,(SELECT COUNT(*) FROM provider_profiles)::int professionals,(SELECT COUNT(*) FROM bookings)::int bookings,(SELECT COALESCE(SUM(commission_kes),0) FROM payments WHERE status='paid') commission_kes");
 s.json({success:true,overview:r.rows[0]});
});
app.patch("/api/admin/providers/:id/verification",auth,role("admin"),async(q,s)=>{
 const r=await db.query("UPDATE provider_profiles SET verified=$1,updated_at=NOW() WHERE id=$2 RETURNING id,business_name,verified",[q.body?.verified===true,q.params.id]);
 if(!r.rowCount)return s.status(404).json({success:false,message:"Provider not found."});
 s.json({success:true,provider:r.rows[0],note:"Verification records an admin review; it is not a guarantee of service quality or safety."});
});
app.use((e,q,s,n)=>{console.error(e);s.status(500).json({success:false,message:"Server error. Check terminal logs."});});
module.exports=app;
