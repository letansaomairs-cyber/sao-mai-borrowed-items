export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
  });
}

export function requireAdmin(request, env) {
  const expected = String(env.ADMIN_PIN || '1000');
  const got = String(request.headers.get('x-admin-pin') || '');
  return got && got === expected;
}

export function nowISO() { return new Date().toISOString(); }
export function clean(v, max = 300) { return String(v ?? '').trim().slice(0, max); }
export function int(v, fallback = 0) {
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? n : fallback;
}
export function loanStatus(r) {
  const resolved = Number(r.returned_qty || 0) + Number(r.lost_qty || 0) + Number(r.damaged_qty || 0);
  const remain = Math.max(0, Number(r.qty || 0) - resolved);
  if (remain <= 0) {
    if (Number(r.lost_qty || 0) > 0 || Number(r.damaged_qty || 0) > 0) return 'resolved_issue';
    return 'returned';
  }
  if (Number(r.returned_qty || 0) > 0) return 'partial';
  return 'borrowing';
}
export function enrich(r) {
  const resolved = Number(r.returned_qty || 0) + Number(r.lost_qty || 0) + Number(r.damaged_qty || 0);
  return { ...r, remaining_qty: Math.max(0, Number(r.qty || 0) - resolved), status: loanStatus(r) };
}
