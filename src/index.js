function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store"
    }
  });
}

function requireAdmin(request, env) {
  const expected = String(env.ADMIN_PIN || "1000");
  const got = String(request.headers.get("x-admin-pin") || "");
  return got && got === expected;
}

function nowISO() {
  return new Date().toISOString();
}

function clean(v, max = 300) {
  return String(v ?? "").trim().slice(0, max);
}

function int(v, fallback = 0) {
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? n : fallback;
}

function loanStatus(r) {
  const resolved =
    Number(r.returned_qty || 0) +
    Number(r.lost_qty || 0) +
    Number(r.damaged_qty || 0);

  const remain = Math.max(0, Number(r.qty || 0) - resolved);

  if (remain <= 0) {
    if (
      Number(r.lost_qty || 0) > 0 ||
      Number(r.damaged_qty || 0) > 0
    ) {
      return "resolved_issue";
    }
    return "returned";
  }

  if (Number(r.returned_qty || 0) > 0) return "partial";

  return "borrowing";
}

function enrich(r) {
  const resolved =
    Number(r.returned_qty || 0) +
    Number(r.lost_qty || 0) +
    Number(r.damaged_qty || 0);

  return {
    ...r,
    remaining_qty: Math.max(0, Number(r.qty || 0) - resolved),
    status: loanStatus(r)
  };
}

function codeFor(dept) {
  const p =
    dept === "fb"
      ? "FB"
      : dept === "housekeeping"
      ? "HK"
      : "FO";

  const d = new Date();

  const date =
    `${d.getFullYear()}` +
    `${String(d.getMonth() + 1).padStart(2, "0")}` +
    `${String(d.getDate()).padStart(2, "0")}`;

  const rand = Math.random()
    .toString(36)
    .slice(2, 6)
    .toUpperCase();

  return `${p}-${date}-${rand}`;
}

/* =========================================================
   POST /api/loans
   Tạo phiếu mượn
========================================================= */

async function createLoan(request, env) {
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

    if (!["fb", "housekeeping", "reception"].includes(department)) {
      return json({ error: "Bộ phận không hợp lệ" }, 400);
    }

    if (!guest_name || !room_no || !item_name) {
      return json(
        { error: "Vui lòng nhập tên khách, số phòng và đồ mượn" },
        400
      );
    }

    const code = codeFor(department);
    const now = nowISO();

    const rs = await env.DB.prepare(`
      INSERT INTO loan_records
      (
        code,
        department,
        guest_name,
        room_no,
        item_name,
        qty,
        staff_name,
        expected_return_date,
        notes,
        created_at,
        updated_at
      )
      VALUES (?,?,?,?,?,?,?,?,?,?,?)
    `)
      .bind(
        code,
        department,
        guest_name,
        room_no,
        item_name,
        qty,
        staff_name,
        expected_return_date,
        notes,
        now,
        now
      )
      .run();

    const id = rs.meta.last_row_id;

    await env.DB.prepare(`
      INSERT INTO loan_history
      (
        loan_id,
        action,
        qty,
        detail,
        created_at
      )
      VALUES (?,?,?,?,?)
    `)
      .bind(
        id,
        "borrow",
        qty,
        `Cấp mượn ${qty} x ${item_name}`,
        now
      )
      .run();

    return json({
      ok: true,
      id,
      code
    });
  } catch (e) {
    return json(
      { error: e?.message || String(e) },
      500
    );
  }
}

/* =========================================================
   GET /api/loans
   Danh sách phiếu
========================================================= */

async function listLoans(request, env) {
  if (!requireAdmin(request, env)) {
    return json({ error: "Sai mã PIN" }, 401);
  }

  try {
    const u = new URL(request.url);

    const department = clean(
      u.searchParams.get("department"),
      30
    );

    const q = clean(
      u.searchParams.get("q"),
      120
    );

    const status = clean(
      u.searchParams.get("status"),
      30
    );

    let sql = `
      SELECT *
      FROM loan_records
      WHERE 1=1
    `;

    const binds = [];

    if (
      department &&
      ["fb", "housekeeping", "reception"].includes(department)
    ) {
      sql += ` AND department=?`;
      binds.push(department);
    }

    if (q) {
      sql += `
        AND (
          guest_name LIKE ?
          OR room_no LIKE ?
          OR item_name LIKE ?
          OR code LIKE ?
        )
      `;

      const x = `%${q}%`;
      binds.push(x, x, x, x);
    }

    sql += ` ORDER BY id DESC LIMIT 500`;

    const rs = await env.DB
      .prepare(sql)
      .bind(...binds)
      .all();

    let rows = (rs.results || []).map(enrich);

    if (status) {
      rows = rows.filter(
        r => r.status === status
      );
    }

    const stats = {
      borrowing: 0,
      partial: 0,
      returned: 0,
      resolved_issue: 0,
      open_items: 0,
      total_rows: rows.length
    };

    for (const r of rows) {
      stats[r.status] =
        (stats[r.status] || 0) + 1;

      stats.open_items += r.remaining_qty;
    }

    return json({
      rows,
      stats
    });
  } catch (e) {
    return json(
      { error: e?.message || String(e) },
      500
    );
  }
}

/* =========================================================
   GET /api/loans/:id
========================================================= */

async function getLoan(request, env, id) {
  if (!requireAdmin(request, env)) {
    return json({ error: "Sai mã PIN" }, 401);
  }

  const loanId = int(id);

  const row = await env.DB.prepare(`
    SELECT *
    FROM loan_records
    WHERE id=?
  `)
    .bind(loanId)
    .first();

  if (!row) {
    return json(
      { error: "Không tìm thấy phiếu" },
      404
    );
  }

  const h = await env.DB.prepare(`
    SELECT *
    FROM loan_history
    WHERE loan_id=?
    ORDER BY id DESC
  `)
    .bind(loanId)
    .all();

  return json({
    row: enrich(row),
    history: h.results || []
  });
}

/* =========================================================
   PATCH /api/loans/:id
========================================================= */

async function updateLoan(request, env, id) {
  if (!requireAdmin(request, env)) {
    return json({ error: "Sai mã PIN" }, 401);
  }

  try {
    const loanId = int(id);
    const b = await request.json();

    const action = clean(b.action, 40);
    const now = nowISO();

    const row = await env.DB.prepare(`
      SELECT *
      FROM loan_records
      WHERE id=?
    `)
      .bind(loanId)
      .first();

    if (!row) {
      return json(
        { error: "Không tìm thấy phiếu" },
        404
      );
    }

    let returnedQty = Number(
      row.returned_qty || 0
    );

    let lostQty = Number(
      row.lost_qty || 0
    );

    let damagedQty = Number(
      row.damaged_qty || 0
    );

    let remain = Math.max(
      0,
      Number(row.qty) -
        returnedQty -
        lostQty -
        damagedQty
    );

    let q = 0;
    let detail = "";

    if (action === "return_one") {
      if (remain < 1) {
        return json(
          { error: "Không còn số lượng để trả" },
          400
        );
      }

      returnedQty += 1;
      q = 1;
      detail = "Trả 1";
    }

    else if (action === "return_all") {
      if (remain < 1) {
        return json(
          { error: "Không còn số lượng để trả" },
          400
        );
      }

      q = remain;
      returnedQty += remain;
      detail = `Trả tất cả ${remain}`;
    }

    else if (action === "lost_one") {
      if (remain < 1) {
        return json(
          { error: "Không còn số lượng để báo mất" },
          400
        );
      }

      lostQty += 1;
      q = 1;
      detail = "Báo mất 1";
    }

    else if (action === "damaged_one") {
      if (remain < 1) {
        return json(
          { error: "Không còn số lượng để báo hỏng" },
          400
        );
      }

      damagedQty += 1;
      q = 1;
      detail = "Báo hỏng 1";
    }

    else if (action === "edit") {
      const guest = clean(
        b.guest_name,
        120
      );

      const room = clean(
        b.room_no,
        30
      );

      const item = clean(
        b.item_name,
        180
      );

      const staff = clean(
        b.staff_name,
        120
      );

      const expected = clean(
        b.expected_return_date,
        20
      );

      const notes = clean(
        b.notes,
        800
      );

      if (!guest || !room || !item) {
        return json(
          { error: "Thiếu thông tin bắt buộc" },
          400
        );
      }

      await env.DB.prepare(`
        UPDATE loan_records
        SET
          guest_name=?,
          room_no=?,
          item_name=?,
          staff_name=?,
          expected_return_date=?,
          notes=?,
          updated_at=?
        WHERE id=?
      `)
        .bind(
          guest,
          room,
          item,
          staff,
          expected,
          notes,
          now,
          loanId
        )
        .run();

      await env.DB.prepare(`
        INSERT INTO loan_history
        (
          loan_id,
          action,
          qty,
          detail,
          created_at
        )
        VALUES (?,?,?,?,?)
      `)
        .bind(
          loanId,
          "edit",
          0,
          "Sửa thông tin phiếu",
          now
        )
        .run();

      const out = await env.DB.prepare(`
        SELECT *
        FROM loan_records
        WHERE id=?
      `)
        .bind(loanId)
        .first();

      return json({
        ok: true,
        row: enrich(out)
      });
    }

    else {
      return json(
        { error: "Thao tác không hợp lệ" },
        400
      );
    }

    const closed =
      returnedQty + lostQty + damagedQty >=
      Number(row.qty)
        ? now
        : null;

    await env.DB.prepare(`
      UPDATE loan_records
      SET
        returned_qty=?,
        lost_qty=?,
        damaged_qty=?,
        updated_at=?,
        closed_at=?
      WHERE id=?
    `)
      .bind(
        returnedQty,
        lostQty,
        damagedQty,
        now,
        closed,
        loanId
      )
      .run();

    await env.DB.prepare(`
      INSERT INTO loan_history
      (
        loan_id,
        action,
        qty,
        detail,
        created_at
      )
      VALUES (?,?,?,?,?)
    `)
      .bind(
        loanId,
        action,
        q,
        detail,
        now
      )
      .run();

    const out = await env.DB.prepare(`
      SELECT *
      FROM loan_records
      WHERE id=?
    `)
      .bind(loanId)
      .first();

    return json({
      ok: true,
      row: enrich(out)
    });
  } catch (e) {
    return json(
      { error: e?.message || String(e) },
      500
    );
  }
}

/* =========================================================
   DELETE /api/loans/:id
========================================================= */

async function deleteLoan(
  request,
  env,
  id
) {
  if (!requireAdmin(request, env)) {
    return json({ error: "Sai mã PIN" }, 401);
  }

  const loanId = int(id);

  await env.DB.prepare(`
    DELETE FROM loan_history
    WHERE loan_id=?
  `)
    .bind(loanId)
    .run();

  await env.DB.prepare(`
    DELETE FROM loan_records
    WHERE id=?
  `)
    .bind(loanId)
    .run();

  return json({
    ok: true
  });
}

/* =========================================================
   GET /api/checkout?room=...
========================================================= */

async function checkCheckout(
  request,
  env
) {
  if (!requireAdmin(request, env)) {
    return json({ error: "Sai mã PIN" }, 401);
  }

  const u = new URL(request.url);

  const room = clean(
    u.searchParams.get("room"),
    30
  );

  if (!room) {
    return json(
      { error: "Nhập số phòng" },
      400
    );
  }

  const rs = await env.DB.prepare(`
    SELECT *
    FROM loan_records
    WHERE room_no=?
    ORDER BY id DESC
  `)
    .bind(room)
    .all();

  const all = (rs.results || [])
    .map(enrich);

  const open = all.filter(
    r => r.remaining_qty > 0
  );

  return json({
    room,
    clear: open.length === 0,
    open,
    all
  });
}

/* =========================================================
   WORKER ROUTER
========================================================= */

export default {
  async fetch(request, env) {
    try {
      const url = new URL(request.url);
      const path = url.pathname;
      const method = request.method.toUpperCase();

      /* ---------- /api/loans ---------- */

      if (path === "/api/loans") {
        if (method === "GET") {
          return listLoans(request, env);
        }

        if (method === "POST") {
          return createLoan(request, env);
        }

        return json(
          { error: "Method not allowed" },
          405
        );
      }

      /* ---------- /api/loans/:id ---------- */

      const loanMatch = path.match(
        /^\/api\/loans\/(\d+)$/
      );

      if (loanMatch) {
        const id = loanMatch[1];

        if (method === "GET") {
          return getLoan(
            request,
            env,
            id
          );
        }

        if (method === "PATCH") {
          return updateLoan(
            request,
            env,
            id
          );
        }

        if (method === "DELETE") {
          return deleteLoan(
            request,
            env,
            id
          );
        }

        return json(
          { error: "Method not allowed" },
          405
        );
      }

      /* ---------- /api/checkout ---------- */

      if (path === "/api/checkout") {
        if (method === "GET") {
          return checkCheckout(
            request,
            env
          );
        }

        return json(
          { error: "Method not allowed" },
          405
        );
      }

      /* ---------- API không tồn tại ---------- */

      if (path.startsWith("/api/")) {
        return json(
          { error: "API not found" },
          404
        );
      }

      /* ---------- Website static ---------- */

      return env.ASSETS.fetch(request);

    } catch (e) {
      return json(
        {
          error:
            e?.message ||
            String(e)
        },
        500
      );
    }
  }
};
