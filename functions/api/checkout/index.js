import { json, requireAdmin, clean, enrich } from '../_common.js';
export async function onRequestGet({ request, env }) {
  if(!requireAdmin(request,env)) return json({error:'Sai mã PIN'},401);
  const u=new URL(request.url); const room=clean(u.searchParams.get('room'),30);
  if(!room) return json({error:'Nhập số phòng'},400);
  const rs=await env.DB.prepare(`SELECT * FROM loan_records WHERE room_no=? ORDER BY id DESC`).bind(room).all();
  const all=(rs.results||[]).map(enrich); const open=all.filter(r=>r.remaining_qty>0);
  return json({room,clear:open.length===0,open,all});
}
