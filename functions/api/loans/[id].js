import { json, requireAdmin, nowISO, clean, int, enrich } from '../_common.js';

export async function onRequestGet({ request, env, params }) {
  if (!requireAdmin(request, env)) return json({error:'Sai mã PIN'},401);
  const id=int(params.id,0);
  const row=await env.DB.prepare(`SELECT * FROM loan_records WHERE id=?`).bind(id).first();
  if(!row) return json({error:'Không tìm thấy phiếu'},404);
  const h=await env.DB.prepare(`SELECT * FROM loan_history WHERE loan_id=? ORDER BY id DESC`).bind(id).all();
  return json({row:enrich(row),history:h.results||[]});
}

export async function onRequestPatch({ request, env, params }) {
  if (!requireAdmin(request, env)) return json({error:'Sai mã PIN'},401);
  try {
    const id=int(params.id,0); const b=await request.json(); const action=clean(b.action,40); const now=nowISO();
    const row=await env.DB.prepare(`SELECT * FROM loan_records WHERE id=?`).bind(id).first();
    if(!row) return json({error:'Không tìm thấy phiếu'},404);
    const resolved=Number(row.returned_qty)+Number(row.lost_qty)+Number(row.damaged_qty);
    const remain=Math.max(0,Number(row.qty)-resolved);
    let rq=Number(row.returned_qty), lq=Number(row.lost_qty), dq=Number(row.damaged_qty), detail='';
    if(action==='return_one'){ if(remain<1) return json({error:'Không còn số lượng để trả'},400); rq+=1; detail='Trả 1'; }
    else if(action==='return_all'){ if(remain<1) return json({error:'Không còn số lượng để trả'},400); rq+=remain; detail=`Trả tất cả ${remain}`; }
    else if(action==='lost_one'){ if(remain<1) return json({error:'Không còn số lượng để báo mất'},400); lq+=1; detail='Báo mất 1'; }
    else if(action==='damaged_one'){ if(remain<1) return json({error:'Không còn số lượng để báo hỏng'},400); dq+=1; detail='Báo hỏng 1'; }
    else if(action==='edit'){
      const guest=clean(b.guest_name,120), room=clean(b.room_no,30), item=clean(b.item_name,180), staff=clean(b.staff_name,120), expected=clean(b.expected_return_date,20), notes=clean(b.notes,800);
      if(!guest||!room||!item) return json({error:'Thiếu thông tin bắt buộc'},400);
      await env.DB.prepare(`UPDATE loan_records SET guest_name=?,room_no=?,item_name=?,staff_name=?,expected_return_date=?,notes=?,updated_at=? WHERE id=?`)
        .bind(guest,room,item,staff,expected,notes,now,id).run();
      await env.DB.prepare(`INSERT INTO loan_history(loan_id,action,qty,detail,created_at) VALUES(?,?,?,?,?)`).bind(id,'edit',0,'Sửa thông tin phiếu',now).run();
      const out=await env.DB.prepare(`SELECT * FROM loan_records WHERE id=?`).bind(id).first(); return json({ok:true,row:enrich(out)});
    } else return json({error:'Thao tác không hợp lệ'},400);
    const closed=(rq+lq+dq)>=Number(row.qty) ? now : null;
    await env.DB.prepare(`UPDATE loan_records SET returned_qty=?,lost_qty=?,damaged_qty=?,updated_at=?,closed_at=? WHERE id=?`)
      .bind(rq,lq,dq,now,closed,id).run();
    await env.DB.prepare(`INSERT INTO loan_history(loan_id,action,qty,detail,created_at) VALUES(?,?,?,?,?)`)
      .bind(id,action,1,detail,now).run();
    const out=await env.DB.prepare(`SELECT * FROM loan_records WHERE id=?`).bind(id).first();
    return json({ok:true,row:enrich(out)});
  } catch(e){ return json({error:e.message || String(e)},500); }
}

export async function onRequestDelete({ request, env, params }) {
  if (!requireAdmin(request, env)) return json({error:'Sai mã PIN'},401);
  const id=int(params.id,0);
  await env.DB.prepare(`DELETE FROM loan_history WHERE loan_id=?`).bind(id).run();
  await env.DB.prepare(`DELETE FROM loan_records WHERE id=?`).bind(id).run();
  return json({ok:true});
}
