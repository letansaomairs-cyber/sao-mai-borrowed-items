function json(data, status = 200) {
  return new Response(JSON.stringify(data), {status, headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
}
function requireAdmin(request, env){const expected=String(env.ADMIN_PIN||'1000');const got=String(request.headers.get('x-admin-pin')||'');return got&&got===expected;}
function nowISO(){return new Date().toISOString();}
function clean(v,max=300){return String(v??'').trim().slice(0,max);}
function int(v,fallback=0){const n=Number.parseInt(v,10);return Number.isFinite(n)?n:fallback;}
function loanStatus(r){const resolved=Number(r.returned_qty||0)+Number(r.lost_qty||0)+Number(r.damaged_qty||0);const remain=Math.max(0,Number(r.qty||0)-resolved);if(remain<=0){if(Number(r.lost_qty||0)>0||Number(r.damaged_qty||0)>0)return'resolved_issue';return'returned';}if(Number(r.returned_qty||0)>0)return'partial';return'borrowing';}
function enrich(r){const resolved=Number(r.returned_qty||0)+Number(r.lost_qty||0)+Number(r.damaged_qty||0);return{...r,remaining_qty:Math.max(0,Number(r.qty||0)-resolved),status:loanStatus(r),image_url:r.image_id?`/api/images/${r.image_id}`:null};}
function codeFor(dept){const p=dept==='fb'?'FB':dept==='housekeeping'?'HK':'FO';const d=new Date();const date=`${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`;const rand=Math.random().toString(36).slice(2,6).toUpperCase();return`${p}-${date}-${rand}`;}
async function ensureImageTable(env){await env.DB.prepare(`CREATE TABLE IF NOT EXISTS loan_images (id INTEGER PRIMARY KEY AUTOINCREMENT,loan_id INTEGER NOT NULL,object_key TEXT NOT NULL UNIQUE,file_name TEXT,content_type TEXT,file_size INTEGER NOT NULL DEFAULT 0,created_at TEXT NOT NULL,FOREIGN KEY (loan_id) REFERENCES loan_records(id) ON DELETE CASCADE)`).run();await env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_loan_images_loan ON loan_images(loan_id)`).run();}
function safeExt(type,name=''){const byType={'image/jpeg':'jpg','image/png':'png','image/webp':'webp','image/gif':'gif'}[type];if(byType)return byType;const m=String(name).toLowerCase().match(/\.([a-z0-9]{2,5})$/);return m?m[1]:'bin';}

async function createLoan(request,env){
  let uploadedKey='';
  try{
    await ensureImageTable(env);
    const form=await request.formData();
    const department=clean(form.get('department'),30),guest_name=clean(form.get('guest_name'),120),room_no=clean(form.get('room_no'),30),item_name=clean(form.get('item_name'),180),qty=Math.max(1,int(form.get('qty'),1)),staff_name=clean(form.get('staff_name'),120),expected_return_date=clean(form.get('expected_return_date'),20),notes=clean(form.get('notes'),800);
    const receipt_lang=clean(form.get('receipt_lang')||'vi',5);
    if(!['fb','housekeeping','reception'].includes(department))return json({error:'Bộ phận không hợp lệ'},400);
    if(!guest_name||!room_no||!item_name)return json({error:'Vui lòng nhập tên khách, số phòng và đồ mượn'},400);
    const image=form.get('image');
    if(image instanceof File&&image.size>0){
      if(image.size>5*1024*1024)return json({error:'Ảnh vượt quá 5MB'},400);
      if(!['image/jpeg','image/png','image/webp','image/gif'].includes(image.type))return json({error:'Chỉ hỗ trợ ảnh JPG, PNG, WEBP hoặc GIF'},400);
    }
    const code=codeFor(department),now=nowISO();
    const rs=await env.DB.prepare(`INSERT INTO loan_records (code,department,guest_name,room_no,item_name,qty,staff_name,expected_return_date,notes,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)`).bind(code,department,guest_name,room_no,item_name,qty,staff_name,expected_return_date,notes,now,now).run();
    const id=rs.meta.last_row_id;
    await env.DB.prepare(`INSERT INTO loan_history (loan_id,action,qty,detail,created_at) VALUES (?,?,?,?,?)`).bind(id,'borrow',qty,`Cấp mượn ${qty} x ${item_name}`,now).run();
    if(image instanceof File&&image.size>0){
      if(!env.IMAGES)throw new Error('R2 binding IMAGES chưa được cấu hình');
      const ext=safeExt(image.type,image.name);uploadedKey=`loans/${code}/${crypto.randomUUID()}.${ext}`;
      await env.IMAGES.put(uploadedKey,image.stream(),{httpMetadata:{contentType:image.type},customMetadata:{loanId:String(id),code,guest:guest_name,room:room_no}});
      await env.DB.prepare(`INSERT INTO loan_images (loan_id,object_key,file_name,content_type,file_size,created_at) VALUES (?,?,?,?,?,?)`).bind(id,uploadedKey,clean(image.name,220),image.type,image.size,now).run();
    }
    const row=await getLoanRow(env,id);
    return json({ok:true,id,code,receipt_lang,row});
  }catch(e){if(uploadedKey&&env.IMAGES){try{await env.IMAGES.delete(uploadedKey)}catch{}}return json({error:e?.message||String(e)},500);}
}

async function getLoanRow(env,id){
  await ensureImageTable(env);
  const row=await env.DB.prepare(`SELECT r.*, i.id AS image_id, i.file_name AS image_name, i.content_type AS image_type, i.file_size AS image_size FROM loan_records r LEFT JOIN loan_images i ON i.loan_id=r.id WHERE r.id=? ORDER BY i.id ASC LIMIT 1`).bind(id).first();
  return row?enrich(row):null;
}

async function listLoans(request,env){if(!requireAdmin(request,env))return json({error:'Sai mã PIN'},401);try{await ensureImageTable(env);const u=new URL(request.url),department=clean(u.searchParams.get('department'),30),q=clean(u.searchParams.get('q'),120),status=clean(u.searchParams.get('status'),30);let sql=`SELECT r.*, i.id AS image_id, i.file_name AS image_name, i.content_type AS image_type, i.file_size AS image_size FROM loan_records r LEFT JOIN loan_images i ON i.loan_id=r.id WHERE 1=1`;const binds=[];if(department&&['fb','housekeeping','reception'].includes(department)){sql+=` AND r.department=?`;binds.push(department)}if(q){sql+=` AND (r.guest_name LIKE ? OR r.room_no LIKE ? OR r.item_name LIKE ? OR r.code LIKE ?)`;const x=`%${q}%`;binds.push(x,x,x,x)}sql+=` GROUP BY r.id ORDER BY r.id DESC LIMIT 500`;const rs=await env.DB.prepare(sql).bind(...binds).all();let rows=(rs.results||[]).map(enrich);if(status)rows=rows.filter(r=>r.status===status);const stats={borrowing:0,partial:0,returned:0,resolved_issue:0,open_items:0,total_rows:rows.length};for(const r of rows){stats[r.status]=(stats[r.status]||0)+1;stats.open_items+=r.remaining_qty}return json({rows,stats});}catch(e){return json({error:e?.message||String(e)},500)}}

async function getLoan(request,env,id){if(!requireAdmin(request,env))return json({error:'Sai mã PIN'},401);const loanId=int(id),row=await getLoanRow(env,loanId);if(!row)return json({error:'Không tìm thấy phiếu'},404);const h=await env.DB.prepare(`SELECT * FROM loan_history WHERE loan_id=? ORDER BY id DESC`).bind(loanId).all();return json({row,history:h.results||[]});}

async function updateLoan(request,env,id){if(!requireAdmin(request,env))return json({error:'Sai mã PIN'},401);try{const loanId=int(id),b=await request.json(),action=clean(b.action,40),now=nowISO();const row=await env.DB.prepare(`SELECT * FROM loan_records WHERE id=?`).bind(loanId).first();if(!row)return json({error:'Không tìm thấy phiếu'},404);let returnedQty=Number(row.returned_qty||0),lostQty=Number(row.lost_qty||0),damagedQty=Number(row.damaged_qty||0),remain=Math.max(0,Number(row.qty)-returnedQty-lostQty-damagedQty),q=0,detail='';if(action==='return_one'){if(remain<1)return json({error:'Không còn số lượng để trả'},400);returnedQty+=1;q=1;detail='Trả 1'}else if(action==='return_all'){if(remain<1)return json({error:'Không còn số lượng để trả'},400);q=remain;returnedQty+=remain;detail=`Trả tất cả ${remain}`}else if(action==='lost_one'){if(remain<1)return json({error:'Không còn số lượng để báo mất'},400);lostQty+=1;q=1;detail='Báo mất 1'}else if(action==='damaged_one'){if(remain<1)return json({error:'Không còn số lượng để báo hỏng'},400);damagedQty+=1;q=1;detail='Báo hỏng 1'}else if(action==='edit'){const guest=clean(b.guest_name,120),room=clean(b.room_no,30),item=clean(b.item_name,180),staff=clean(b.staff_name,120),expected=clean(b.expected_return_date,20),notes=clean(b.notes,800);if(!guest||!room||!item)return json({error:'Thiếu thông tin bắt buộc'},400);await env.DB.prepare(`UPDATE loan_records SET guest_name=?,room_no=?,item_name=?,staff_name=?,expected_return_date=?,notes=?,updated_at=? WHERE id=?`).bind(guest,room,item,staff,expected,notes,now,loanId).run();await env.DB.prepare(`INSERT INTO loan_history (loan_id,action,qty,detail,created_at) VALUES (?,?,?,?,?)`).bind(loanId,'edit',0,'Sửa thông tin phiếu',now).run();return json({ok:true,row:await getLoanRow(env,loanId)})}else return json({error:'Thao tác không hợp lệ'},400);const closed=returnedQty+lostQty+damagedQty>=Number(row.qty)?now:null;await env.DB.prepare(`UPDATE loan_records SET returned_qty=?,lost_qty=?,damaged_qty=?,updated_at=?,closed_at=? WHERE id=?`).bind(returnedQty,lostQty,damagedQty,now,closed,loanId).run();await env.DB.prepare(`INSERT INTO loan_history (loan_id,action,qty,detail,created_at) VALUES (?,?,?,?,?)`).bind(loanId,action,q,detail,now).run();return json({ok:true,row:await getLoanRow(env,loanId)});}catch(e){return json({error:e?.message||String(e)},500)}}

async function deleteLoan(request,env,id){if(!requireAdmin(request,env))return json({error:'Sai mã PIN'},401);const loanId=int(id);await ensureImageTable(env);const imgs=await env.DB.prepare(`SELECT object_key FROM loan_images WHERE loan_id=?`).bind(loanId).all();if(env.IMAGES){for(const x of imgs.results||[]){try{await env.IMAGES.delete(x.object_key)}catch{}}}await env.DB.prepare(`DELETE FROM loan_images WHERE loan_id=?`).bind(loanId).run();await env.DB.prepare(`DELETE FROM loan_history WHERE loan_id=?`).bind(loanId).run();await env.DB.prepare(`DELETE FROM loan_records WHERE id=?`).bind(loanId).run();return json({ok:true});}

async function checkCheckout(request,env){if(!requireAdmin(request,env))return json({error:'Sai mã PIN'},401);await ensureImageTable(env);const u=new URL(request.url),room=clean(u.searchParams.get('room'),30);if(!room)return json({error:'Nhập số phòng'},400);const rs=await env.DB.prepare(`SELECT r.*, i.id AS image_id, i.file_name AS image_name FROM loan_records r LEFT JOIN loan_images i ON i.loan_id=r.id WHERE r.room_no=? GROUP BY r.id ORDER BY r.id DESC`).bind(room).all();const all=(rs.results||[]).map(enrich),open=all.filter(r=>r.remaining_qty>0);return json({room,clear:open.length===0,open,all});}

async function serveImage(env,id){await ensureImageTable(env);const img=await env.DB.prepare(`SELECT object_key,file_name,content_type FROM loan_images WHERE id=?`).bind(int(id)).first();if(!img)return new Response('Not found',{status:404});if(!env.IMAGES)return new Response('R2 binding missing',{status:500});const obj=await env.IMAGES.get(img.object_key);if(!obj)return new Response('Not found',{status:404});const headers=new Headers();obj.writeHttpMetadata(headers);headers.set('content-type',img.content_type||headers.get('content-type')||'application/octet-stream');headers.set('cache-control','private, max-age=300');headers.set('content-disposition',`inline; filename*=UTF-8''${encodeURIComponent(img.file_name||'image')}`);return new Response(obj.body,{headers});}

export default{async fetch(request,env){try{const url=new URL(request.url),path=url.pathname,method=request.method.toUpperCase();if(path==='/api/loans'){if(method==='GET')return listLoans(request,env);if(method==='POST')return createLoan(request,env);return json({error:'Method not allowed'},405)}const loanMatch=path.match(/^\/api\/loans\/(\d+)$/);if(loanMatch){const id=loanMatch[1];if(method==='GET')return getLoan(request,env,id);if(method==='PATCH')return updateLoan(request,env,id);if(method==='DELETE')return deleteLoan(request,env,id);return json({error:'Method not allowed'},405)}if(path==='/api/checkout'){if(method==='GET')return checkCheckout(request,env);return json({error:'Method not allowed'},405)}const imageMatch=path.match(/^\/api\/images\/(\d+)$/);if(imageMatch&&method==='GET')return serveImage(env,imageMatch[1]);if(path.startsWith('/api/'))return json({error:'API not found'},404);return env.ASSETS.fetch(request);}catch(e){return json({error:e?.message||String(e)},500)}}};
