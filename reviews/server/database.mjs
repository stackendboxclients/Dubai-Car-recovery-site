import {Pool} from 'pg';

const idPattern=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const publicFields=row=>({
 id:row.id,
 customer_name:row.customer_name,
 rating:Number(row.rating),
 review_text:row.review_text,
 created_at:new Date(row.created_at).toISOString()
});
let connection,pool,sql;

export function reviewSql() {
 const url=process.env.POSTGRES_URL||process.env.DATABASE_URL;
 if(!url||!/^postgres(?:ql)?:\/\//.test(url))throw new Error('Review database is not configured');
 if(url!==connection){
  if(pool)void pool.end();
  connection=url;
  pool=new Pool({connectionString:url,max:1,connectionTimeoutMillis:5000,idleTimeoutMillis:1000,ssl:{rejectUnauthorized:true}});
  pool.on('error',()=>{});
  sql=async(strings,...values)=>{
   const text=strings.reduce((query,part,index)=>query+part+(index<values.length?'$'+(index+1):''),'');
   const result=await pool.query(text,values);
   return result.rows;
  };
 }
 return sql;
}

function parseCursor(cursor) {
 if(!cursor)return null;
 try {
  if(typeof cursor!=='string'||cursor.length>180||!/^[A-Za-z0-9_-]+$/.test(cursor))throw new Error();
  const [date,id]=JSON.parse(Buffer.from(cursor,'base64url').toString('utf8'));
  if(!idPattern.test(id)||typeof date!=='string'||!Number.isFinite(Date.parse(date)))throw new Error();
  return {date,id};
 }catch{const error=new Error('Invalid review page.');error.code='INVALID_CURSOR';throw error;}
}
const makeCursor=row=>Buffer.from(JSON.stringify([new Date(row.created_at).toISOString(),row.id])).toString('base64url');

export function createReviewRepository(getSql=reviewSql) {
 async function save(input) {
  const db=getSql();
  const inserted=await db`INSERT INTO customer_reviews
   (id,customer_name,rating,review_text,submission_hash,source,status)
   VALUES (${input.p_request_id},${input.p_name},${input.p_rating},${input.p_text},${input.p_submission_hash},'customer_submission','published')
   ON CONFLICT DO NOTHING
   RETURNING id,customer_name,rating,review_text,created_at`;
  if(inserted[0])return publicFields(inserted[0]);
  const existing=await db`SELECT id,customer_name,rating,review_text,created_at,submission_hash
   FROM customer_reviews WHERE id=${input.p_request_id}`;
  if(existing[0]&&existing[0].customer_name===input.p_name&&Number(existing[0].rating)===input.p_rating&&existing[0].review_text===input.p_text&&existing[0].submission_hash===input.p_submission_hash)return publicFields(existing[0]);
  const error=new Error(existing[0]?'This request was already used. Please refresh and try again.':'This review has already been submitted.');
  error.code='REQUEST_CONFLICT';throw error;
 }
 async function stats() {
  const db=getSql();
  const [row]=await db`SELECT COUNT(*)::integer AS count,COALESCE(AVG(rating),0)::float8 AS average
   FROM customer_reviews WHERE status='published' AND source='customer_submission'`;
  return {count:Number(row.count),average:Number(Number(row.average).toFixed(1))};
 }
 async function page({cursor,limit=6}={}) {
  const db=getSql(),after=parseCursor(cursor),size=Math.min(20,Math.max(1,Number(limit)||6));
  const rows=after
   ?await db`SELECT id,customer_name,rating,review_text,created_at FROM customer_reviews
     WHERE status='published' AND source='customer_submission'
     AND (created_at,id)<(${after.date}::timestamptz,${after.id}::uuid)
     ORDER BY created_at DESC,id DESC LIMIT ${size+1}`
   :await db`SELECT id,customer_name,rating,review_text,created_at FROM customer_reviews
     WHERE status='published' AND source='customer_submission'
     ORDER BY created_at DESC,id DESC LIMIT ${size+1}`;
  const visible=rows.slice(0,size);
  return {reviews:visible.map(publicFields),nextCursor:rows.length>size?makeCursor(visible.at(-1)):null,stats:await stats()};
 }
 return {save,page,stats};
}

export const reviewRepository=createReviewRepository();
