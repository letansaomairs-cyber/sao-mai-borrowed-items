import { json, requireAdmin, nowISO, clean, int, enrich } from '../_common.js';

function codeFor(dept) {
  const p = dept === 'fb' ? 'FB' : dept === 'housekeeping' ? 'HK' : 'FO';
  const d = new Date();
  const date = `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`;
  const rand = Math.random().toString(36).slice(2,6).toUpperCase();
  return `${p}-${date}-${rand}`;
}

export async function onRequestPost({ request, env }) {
  try {
    const b = await request.json();
    const department = clean(b.department, 30);
    const guest_name = clean(b.guest_name, 120);
    const room_no = clean(b.room_no, 30);
    const item_name = clean(b.item_name, 180);
    const qty = Math.max(1, int(b.qty, 1));
    const staff_name = clean(b.staff_name, 120);
    const expected_return_date = clean(b.expected_return_date, 20);
    const notes = clean(b.notes, 800);
    if (!['fb','housekeeping','reception'].includes(department)) return json({error:'Bộ phận không hợp lệ'},400);
    if (!guest_name || !room_no || !item_name) return json({error:'Vui lòng nhập tên khách, số phòng và đồ mượn'},400);
    const code = codeFor(department);
    const now = nowISO();
    const res = await env.DB.prepare(`INSERT INTO loan_records
      (code,department,guest_name,room_no,item_name,qty,staff_name,expected_return_date,notes,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)`)
      .bind(code,department,guest_name,room_no,item_name,qty,staff_name,expected_return_date,notes,now,now).run();
    const id = res.meta.last_row_id;
    await env.DB.prepare(`INSERT INTO loan_history(loan_id,action,qty,detail,created_at) VALUES(?,?,?,?,?)`)
      .bind(id,'borrow',qty,`Cấp mượn ${qty} x ${item_name}`,now).run();
    return json({ok:true,id,code});
  } catch(e) { return json({error:e.message || String(e)},500); }
}

export async function onRequestGet({ request, env }) {
  if (!requireAdmin(request, env)) return json({error:'Sai mã PIN'},401);
  try {
    const u = new URL(request.url);
    const department = clean(u.searchParams.get('department'),30);
    const q = clean(u.searchParams.get('q'),120);
    const status = clean(u.searchParams.get('status'),30);
    let sql = `SELECT * FROM loan_records WHERE 1=1`;
    const binds=[];
    if (department && ['fb','housekeeping','reception'].includes(department)) { sql += ` AND department=?`; binds.push(department); }
    if (q) { sql += ` AND (guest_name LIKE ? OR room_no LIKE ? OR item_name LIKE ? OR code LIKE ?)`; const x=`%${q}%`; binds.push(x,x,x,x); }
    sql += ` ORDER BY id DESC LIMIT 500`;
    const rs = await env.DB.prepare(sql).bind(...binds).all();
    let rows=(rs.results||[]).map(enrich);
    if (status) rows=rows.filter(r=>r.status===status);
    const stats={borrowing:0,partial:0,returned:0,resolved_issue:0,open_items:0,total:rows.length};
    for(const r of rows){ stats[r.status]=(stats[r.status]||0)+1; stats.open_items+=r.remaining_qty; }
    return json({rows,stats});
  } catch(e) { return json({error:e.message || String(e)},500); }
}
