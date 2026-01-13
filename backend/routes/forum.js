// backend/routes/forum.js  (CLEAN SLATE)
import express from "express";
import db, { dbGet, dbRun, dbAll } from "../db.js";
import requireAdmin from "../middleware/requireAdmin.js";
import { runAutoBadges } from "../services/badge-engine.js";




import requireMember from "../middleware/requireMember.js";
import requireMemberOptional from "../middleware/requireMemberOptional.js";

const router = express.Router();

// --------------------------------------------
// Helpers
// --------------------------------------------
function toInt(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function extractMentions(text) {
  if (!text) return [];
  const matches = text.match(/@([a-zA-Z0-9_]{3,30})/g) || [];
  return [...new Set(matches.map(m => m.slice(1).toLowerCase()))];
}


function pickSort(sort) {
  // Supported sorts: "new", "top"
  return sort === "top" ? "top" : "new";
}

function logModeratorAction(db, {
  communityId,
  actorId,
  action,
  targetType,
  targetId = null,
  metadata = null
}) {
  db.run(
    `
    INSERT INTO forum_moderator_logs
      (community_id, actor_id, action, target_type, target_id, metadata, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
    [
      communityId,
      actorId,
      action,
      targetType,
      targetId,
      metadata ? JSON.stringify(metadata) : null,
      Date.now()
    ]
  );
}

function bumpMemberKarma(db, memberId, deltas) {
  const post = Number(deltas.post || 0);
  const reply = Number(deltas.reply || 0);
  const total = Number(deltas.total || 0);

  db.run(
    `
    UPDATE members
    SET
      post_karma = CASE WHEN COALESCE(post_karma,0) + ? < 0 THEN 0 ELSE COALESCE(post_karma,0) + ? END,
      reply_karma = CASE WHEN COALESCE(reply_karma,0) + ? < 0 THEN 0 ELSE COALESCE(reply_karma,0) + ? END,
      total_karma = CASE WHEN COALESCE(total_karma,0) + ? < 0 THEN 0 ELSE COALESCE(total_karma,0) + ? END
    WHERE id = ?
    `,
    [post, post, reply, reply, total, total, memberId]
  );
}

function requireCommunityModerator(req, res, next) {
  const communityId =
    Number(req.params.id) ||
    Number(req.params.community_id) ||
    Number(req.body.community_id);

  const memberId = req.memberId;

  if (!communityId || !memberId) {
    return res.status(400).json({ error: "Invalid request" });
  }

  db.get(
    `
    SELECT 1
    FROM forum_community_moderators
    WHERE community_id = ?
      AND member_id = ?
    UNION
    SELECT 1
    FROM forum_communities
    WHERE id = ?
      AND created_by = ?
    LIMIT 1
    `,
    [communityId, memberId, communityId, memberId],
    (err, row) => {
      if (err) return res.status(500).json({ error: "DB error" });
      if (!row) return res.status(403).json({ error: "Moderator access required" });
      next();
    }
  );
}



function bumpCommunityKarma(db, communityId, memberId, deltas) {
  const post = Number(deltas.post || 0);
  const reply = Number(deltas.reply || 0);
  const total = Number(deltas.total || 0);
  const now = Date.now();

  db.run(
    `
    INSERT INTO forum_community_karma
      (community_id, member_id, post_karma, reply_karma, total_karma, last_updated)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT (community_id, member_id)
    DO UPDATE SET
      post_karma = CASE WHEN COALESCE(post_karma,0) + ? < 0 THEN 0 ELSE COALESCE(post_karma,0) + ? END,
      reply_karma = CASE WHEN COALESCE(reply_karma,0) + ? < 0 THEN 0 ELSE COALESCE(reply_karma,0) + ? END,
      total_karma = CASE WHEN COALESCE(total_karma,0) + ? < 0 THEN 0 ELSE COALESCE(total_karma,0) + ? END,
      last_updated = excluded.last_updated
    `,
    [
      communityId, memberId, post, reply, total, now,
      post, post, reply, reply, total, total
    ]
  );
}

function requireCommunityMod({ allowOwner = true } = {}) {
  return (req, res, next) => {
    const communityId =
      Number(req.params.community_id) ||
      Number(req.body.community_id) ||
      Number(req.communityId);

    if (!communityId || !req.memberId) {
      return res.status(403).json({ error: "Forbidden" });
    }

    db.get(
      `
      SELECT role
      FROM forum_community_moderators
      WHERE community_id = ? AND member_id = ?
      `,
      [communityId, req.memberId],
      (err, row) => {
        if (err) return res.status(500).json({ error: "DB error" });
        if (!row) return res.status(403).json({ error: "Not a moderator" });
        if (!allowOwner && row.role === "owner") {
          return res.status(403).json({ error: "Owners not allowed" });
        }

        req.modRole = row.role;
        next();
      }
    );
  };
}



// --------------------------------------------
// GET /api/forum/health
// --------------------------------------------
router.get("/health", (req, res) => {
  res.json({ ok: true });
});

// ================================
// GET /api/forum/communities
// Public list of communities
// ================================
router.get("/communities", (req, res) => {
  res.set("Cache-Control", "no-store");

  db.all(
    `
    SELECT id, name, description, is_private, status
    FROM forum_communities
    WHERE status = 'approved'
    ORDER BY name ASC
    `,
    [],
    (err, rows) => {
      if (err) {
        console.error("GET /forum/communities DB error:", err);
        return res.status(500).json({ error: "DB error" });
      }
      res.json({ communities: rows || [] });
    }
  );
});




router.get("/communities/:id", requireMember, (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: "Invalid community id" });

db.get(
  `
SELECT
  c.id,
  c.name,
  c.description,
  c.is_private,

  EXISTS (
    SELECT 1
    FROM forum_community_members m
    WHERE m.community_id = c.id
      AND m.member_id = ?
      AND m.status = 'active'
  ) AS viewer_joined,

  EXISTS (
    SELECT 1
    FROM forum_community_moderators m
    WHERE m.community_id = c.id
      AND m.member_id = ?
  ) AS viewer_is_mod,

  (c.created_by = ?) AS viewer_is_owner,

  (
    SELECT COUNT(*)
    FROM forum_community_members m2
    WHERE m2.community_id = c.id
      AND m2.status = 'active'
  ) AS member_count,

  (
    SELECT COUNT(*)
    FROM forum_threads t
    WHERE t.community_id = c.id
  ) AS thread_count

FROM forum_communities c
WHERE c.id = ?
AND (
  c.status = 'approved'
  OR c.created_by = ?
)

  `,

  
[
  req.memberId || null, // viewer_joined
  req.memberId || null, // viewer_is_mod
  req.memberId || null, // viewer_is_owner
  id,
  req.memberId || null  // <-- NEW: creator visibility
],

  (err, row) => {
    if (err) {
      console.error("GET /communities/:id DB error:", err);
      return res.status(500).json({ error: "DB error" });
    }
    if (!row) return res.status(404).json({ error: "Not found" });

    res.json({ community: row });
  }
);

});


// --------------------------------------------
// POST /communities/:id/moderators (ADD MODERATOR)
// --------------------------------------------

router.post(
  "/communities/:id/moderators",
  requireMember,
  (req, res) => {
    const communityId = Number(req.params.id);
    const { member_id } = req.body;

    if (!communityId || !member_id) {
      return res.status(400).json({ error: "Invalid input" });
    }

    // 1️⃣ Verify requester is OWNER
    db.get(
      `
      SELECT role
      FROM forum_community_moderators
      WHERE community_id = ? AND member_id = ?
      `,
      [communityId, req.memberId],
      (err, row) => {
        if (err) return res.status(500).json({ error: "DB error" });
        if (!row || row.role !== "owner") {
          return res.status(403).json({ error: "Owner only" });
        }

        // 2️⃣ Add moderator
        db.run(
          `
          INSERT OR IGNORE INTO forum_community_moderators
            (community_id, member_id, role, created_at)
          VALUES (?, ?, 'moderator', ?)
          `,
          [communityId, member_id, Date.now()],
          function (err2) {
            if (err2) return res.status(500).json({ error: "DB error" });
            res.json({ success: true });

            logModeratorAction(db, {
                communityId,
                actorId: req.memberId,
                action: "add_moderator",
                targetType: "member",
                targetId: member_id
              });

          }
        );
      }
    );
  }
);

// --------------------------------------------
// POST /communities/:id/moderators/:memberId (REMOVE MODERATOR)
// --------------------------------------------
router.delete(
  "/communities/:id/moderators/:memberId",
  requireMember,
  (req, res) => {
    const communityId = Number(req.params.id);
    const targetId = Number(req.params.memberId);

    if (!communityId || !targetId) {
      return res.status(400).json({ error: "Invalid input" });
    }

    // 1️⃣ Verify requester is OWNER
    db.get(
      `
      SELECT role
      FROM forum_community_moderators
      WHERE community_id = ? AND member_id = ?
      `,
      [communityId, req.memberId],
      (err, ownerRow) => {
        if (err) return res.status(500).json({ error: "DB error" });
        if (!ownerRow || ownerRow.role !== "owner") {
          return res.status(403).json({ error: "Owner only" });
        }

        // 2️⃣ Prevent removing owner
        db.get(
          `
          SELECT role
          FROM forum_community_moderators
          WHERE community_id = ? AND member_id = ?
          `,
          [communityId, targetId],
          (err2, targetRow) => {
            if (err2) return res.status(500).json({ error: "DB error" });
            if (!targetRow) {
              return res.status(404).json({ error: "Not a moderator" });
            }
            if (targetRow.role === "owner") {
              return res.status(403).json({ error: "Cannot remove owner" });
            }

            // 3️⃣ Remove moderator
            db.run(
              `
              DELETE FROM forum_community_moderators
              WHERE community_id = ? AND member_id = ?
              `,
              [communityId, targetId],
              function (err3) {
                if (err3) return res.status(500).json({ error: "DB error" });
                res.json({ success: true });

                logModeratorAction(db, {
                    communityId,
                    actorId: req.memberId,
                    action: "remove_moderator",
                    targetType: "member",
                    targetId: targetId
                  });

              }
            );
          }
        );
      }
    );
  }
);

router.get(
  "/communities/:id/moderators",
  requireMemberOptional,
  (req, res) => {
    const communityId = Number(req.params.id);
    if (!communityId) {
      return res.status(400).json({ error: "Invalid community id" });
    }

    db.all(
      `
      SELECT
        m.member_id,
        m.role,
        u.first_name,
        u.last_name,
        u.avatar_url
      FROM forum_community_moderators m
      JOIN members u ON u.id = m.member_id
      WHERE m.community_id = ?
      ORDER BY
        CASE m.role WHEN 'owner' THEN 0 ELSE 1 END,
        u.first_name
      `,
      [communityId],
      (err, rows) => {
        if (err) return res.status(500).json({ error: "DB error" });
        res.json({ moderators: rows });
      }
    );
  }
);

router.get(
  "/communities/:id/modlog",
  requireMember,
  (req, res) => {
    const communityId = Number(req.params.id);
    if (!communityId) {
      return res.status(400).json({ error: "Invalid community id" });
    }

    // Only mods / owners can view
    db.get(
      `
      SELECT role
      FROM forum_community_moderators
      WHERE community_id = ? AND member_id = ?
      `,
      [communityId, req.memberId],
      (err, mod) => {
        if (err) return res.status(500).json({ error: "DB error" });
        if (!mod) return res.status(403).json({ error: "Forbidden" });

        db.all(
          `
          SELECT
            l.id,
            l.action,
            l.target_type,
            l.target_id,
            l.metadata,
            l.created_at,

            m.first_name,
            m.last_name,
            m.avatar_url
          FROM forum_moderator_logs l
          JOIN members m ON m.id = l.actor_id
          WHERE l.community_id = ?
          ORDER BY l.created_at DESC
          LIMIT 100
          `,
          [communityId],
          (err2, rows) => {
            if (err2) return res.status(500).json({ error: "DB error" });
            res.json({ logs: rows });
          }
        );
      }
    );
  }
);
router.post(
  "/communities/:id/rules",
  requireMember,
  requireCommunityModerator,
  (req, res) => {
    const communityId = Number(req.params.id);
    const { title, body } = req.body;

    if (!title) {
      return res.status(400).json({ error: "Title required" });
    }

    const now = Date.now();

    db.run(
      `
      INSERT INTO forum_community_rules
        (community_id, title, body, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
      `,
      [communityId, title, body || "", now, now],
      function (err) {
        if (err) return res.status(500).json({ error: "DB error" });
        res.json({ success: true, ruleId: this.lastID });
      }
    );
  }
);

router.put(
  "/communities/:id/rules/:ruleId",
  requireMember,
  requireCommunityModerator,
  (req, res) => {
    const ruleId = Number(req.params.ruleId);
    const { title, body } = req.body;

  db.run(
    `
    UPDATE forum_community_rules
    SET title = ?, body = ?, updated_at = ?
    WHERE id = ?
    `,
    [title, body || "", Date.now(), ruleId],
    (err) => {
      if (err) return res.status(500).json({ error: "DB error" });
      res.json({ success: true });
    }
  );

  }
);


router.delete(
  "/communities/:id/rules/:ruleId",
  requireMember,
  requireCommunityModerator,
  (req, res) => {
    const ruleId = Number(req.params.ruleId);

    db.run(
      `DELETE FROM forum_community_rules WHERE id = ?`,
      [ruleId],
      (err) => {
        if (err) return res.status(500).json({ error: "DB error" });
        res.json({ success: true });
      }
    );
  }
);

// --------------------------------------------
// GET /api/forum/threads/:id   (Single thread)
// --------------------------------------------
router.get("/threads/:id", requireMemberOptional, (req, res) => {
  const threadId = toInt(req.params.id);
  if (!threadId) return res.status(400).json({ error: "Invalid thread id" });

  db.get(
    `
        SELECT
      t.id,
      t.community_id,
      t.member_id,
      t.title,

      CASE
        WHEN t.is_deleted = 1 THEN '[deleted]'
        ELSE t.body
      END AS body,

      t.created_at,
      t.edited_at,

      t.is_deleted,
      t.is_locked,
      t.is_archived,
      t.archived_at,

      COALESCE(m.first_name, '') AS first_name,
      COALESCE(m.last_name, '') AS last_name,
      COALESCE(m.avatar_url, m.avatar, NULL) AS avatar_url,

      (SELECT COUNT(*)
      FROM forum_thread_amens ta
      WHERE ta.thread_id = t.id) AS amen_count,

      CASE
        WHEN ? IS NULL THEN 0
        ELSE EXISTS(
          SELECT 1
          FROM forum_thread_amens ta2
          WHERE ta2.thread_id = t.id
            AND ta2.member_id = ?
        )
      END AS viewer_amened

    FROM forum_threads t
    LEFT JOIN members m ON m.id = t.member_id
    WHERE t.id = ?
    LIMIT 1

    `,
    [req.memberId || null, req.memberId || null, threadId],
    (err, row) => {
      if (err) return res.status(500).json({ error: "DB error" });
      if (!row) return res.status(404).json({ error: "Thread not found" });
      res.json({ thread: row });
    }
  );
});


router.get("/threads", requireMemberOptional, (req, res) => {
  console.log("[FORUM /threads] query:", req.query);
  console.log("[FORUM /threads] member:", req.member?.id || null);
  const communityId = Number(req.query.community_id) || null;
  const q = (req.query.q || "").trim();

  const allowedSorts = ["new", "top", "hot"];
  const sort = allowedSorts.includes(req.query.sort)
    ? req.query.sort
    : "new";

  const where = [];
  const params = [];

  if (communityId) {
    where.push("t.community_id = ?");
    params.push(communityId);
  }

  if (q) {
    where.push("(t.title LIKE ? OR t.body LIKE ?)");
    const like = `%${q}%`;
    params.push(like, like);
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  let orderSql = "t.created_at DESC";
  if (sort === "top") {
    orderSql = "amen_count DESC, t.created_at DESC";
  }
  if (sort === "hot") {
    orderSql = "(amen_count * 2 + reply_count) DESC, t.created_at DESC";
  }

  db.all(
    `
    SELECT
      t.id,
      t.community_id,
      t.member_id,
      t.title,
      t.body,
      t.created_at,
      t.edited_at,

      COALESCE(m.first_name,'') AS first_name,
      COALESCE(m.last_name,'') AS last_name,
      COALESCE(m.avatar_url, m.avatar, NULL) AS avatar_url,

      (SELECT COUNT(*) FROM forum_replies r WHERE r.thread_id = t.id) AS reply_count,
      (SELECT COUNT(*) FROM forum_thread_amens a WHERE a.thread_id = t.id) AS amen_count,

      CASE
        WHEN ? IS NULL THEN 0
        ELSE EXISTS (
          SELECT 1 FROM forum_thread_amens a2
          WHERE a2.thread_id = t.id AND a2.member_id = ?
        )
      END AS viewer_amened

    FROM forum_threads t
    LEFT JOIN members m ON m.id = t.member_id
    ${whereSql}
    ORDER BY ${orderSql}
    LIMIT 100

    `,
    [req.memberId || null, req.memberId || null, ...params],
    (err, rows) => {
      if (err) {
        console.error("GET /threads DB error:", err);
        return res.status(500).json({ error: "DB error" });
      }

      res.json({
        threads: rows || [],
        viewer: req.member ? { id: req.member.id } : null,
      });
    }
  );
});

// --------------------------------------------
// POST /api/forum/threads  (CREATE THREAD)
// --------------------------------------------
router.post("/threads", requireMember, async (req, res) => {
  const memberId = req.memberId;
  const { community_id, title, body } = req.body || {};

function emitCommunityUpdate(communityId, reason) {
  const room = globalThis.__hcCommunityRooms?.get(Number(communityId));
  if (!room) return;

  const payload = JSON.stringify({
    type: "community:update",
    communityId,
    reason
  });

  room.forEach(ws => {
    if (ws.readyState === 1) {
      ws.send(payload);
    }
  });
}



  if (!community_id || !title || !body) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    const now = Date.now();

    const result = await dbRun(

      
      `
      INSERT INTO forum_threads
        (community_id, member_id, title, body, created_at)
      VALUES (?, ?, ?, ?, ?)
      `,
      [
        Number(community_id),
        memberId,
        String(title).trim(),
        String(body).trim(),
        now,
      ]
    );

    emitCommunityUpdate(community_id, "thread");

    res.status(201).json({
      success: true,
      threadId: result.lastID,
    });


  } catch (err) {
    console.error("POST /forum/threads error:", err);
    res.status(500).json({ error: "Failed to create thread" });
  }
});

// --------------------------------------------
// PUT /api/forum/threads/:id  (EDIT THREAD)
// --------------------------------------------
router.put("/threads/:id", requireMember, (req, res) => {
  const threadId = toInt(req.params.id);
  if (!threadId) return res.status(400).json({ error: "Invalid thread id" });

  const memberId = req.memberId;
  const { title, body } = req.body || {};
  const now = Date.now();

  if (!title || !body) {
    return res.status(400).json({ error: "Missing title or body" });
  }

  db.get(
    `
    SELECT member_id, created_at
    FROM forum_threads
    WHERE id = ?
    `,
    [threadId],
    (err, row) => {
      if (err || !row) {
        return res.status(404).json({ error: "Thread not found" });
      }

      // 🔐 Ownership check
      if (row.member_id !== memberId) {
        return res.status(403).json({ error: "Not authorized" });
      }

      // ⏱️ Time limit (15 minutes)
      if (Date.now() - row.created_at > 15 * 60 * 1000) {
        return res.status(403).json({ error: "Edit window expired" });
      }

      db.run(
        `
        UPDATE forum_threads
        SET title = ?, body = ?, edited_at = ?
        WHERE id = ?
        `,
        [title.trim(), body.trim(), now, threadId],
        (err2) => {
          if (err2) {
            return res.status(500).json({ error: "Failed to update thread" });
          }

          res.json({ success: true });
        }
      );
    }
  );
});


// --------------------------------------------
// PUT /api/forum/replies/:id  (EDIT REPLY)
// --------------------------------------------
router.put("/replies/:id", requireMember, (req, res) => {
  const replyId = toInt(req.params.id);
  if (!replyId) return res.status(400).json({ error: "Invalid reply id" });

  const memberId = req.memberId;
  const { body } = req.body || {};
  const now = Date.now();

  if (!body) {
    return res.status(400).json({ error: "Missing body" });
  }

  db.get(
    `
    SELECT member_id, created_at
    FROM forum_replies
    WHERE id = ?
    `,
    [replyId],
    (err, row) => {
      if (err || !row) {
        return res.status(404).json({ error: "Reply not found" });
      }

      if (row.member_id !== memberId) {
        return res.status(403).json({ error: "Not authorized" });
      }

      if (Date.now() - row.created_at > 15 * 60 * 1000) {
        return res.status(403).json({ error: "Edit window expired" });
      }

      db.run(
        `
        UPDATE forum_replies
        SET body = ?, edited_at = ?
        WHERE id = ?
        `,
        [body.trim(), now, replyId],
        (err2) => {
          if (err2) {
            return res.status(500).json({ error: "Failed to update reply" });
          }

          res.json({ success: true });
        }
      );
    }
  );
});

// --------------------------------------------
// DELETE /api/forum/threads/:id (SOFT DELETE)
// --------------------------------------------
router.delete("/threads/:id", requireMember, (req, res) => {
  const threadId = Number(req.params.id);
  if (!threadId) {
    return res.status(400).json({ error: "Invalid thread id" });
  }

  db.run(
    `
    UPDATE forum_threads
    SET
      is_deleted = 1,
      deleted_at = ?
    WHERE id = ?
    AND is_deleted = 0
    AND (
      member_id = ?
      OR EXISTS (
        SELECT 1 FROM forum_community_moderators
        WHERE community_id = forum_threads.community_id
          AND member_id = ?
      )
    )

    `,
    [Date.now(), threadId, req.memberId, req.memberId],

    function (err) {
      if (err) {
        return res.status(500).json({ error: "DB error" });
      }

      if (this.changes === 0) {
        return res.status(403).json({ error: "Not allowed" });
      }
      // ==============================
// KARMA ADJUSTMENT: THREAD DELETE
// ==============================
db.get(
  `
  SELECT
    t.member_id AS author_id,
    t.community_id,
    COUNT(a.id) AS amen_count
  FROM forum_threads t
  LEFT JOIN forum_thread_amens a ON a.thread_id = t.id
  WHERE t.id = ?
  GROUP BY t.id
  `,
  [threadId],
  (err2, row) => {
    if (err2 || !row || !row.amen_count) return;

    const delta = -Number(row.amen_count);

    bumpMemberKarma(db, row.author_id, {
      post: delta,
      total: delta
    });

    bumpCommunityKarma(
      db,
      row.community_id,
      row.author_id,
      {
        post: delta,
        total: delta
      }
    );
  }
);


      res.json({ success: true });
    }
  );
});

// --------------------------------------------
// DELETE /api/forum/replies/:id (SOFT DELETE)
// --------------------------------------------
router.delete("/replies/:id", requireMember, (req, res) => {
  const replyId = Number(req.params.id);
  if (!replyId) {
    return res.status(400).json({ error: "Invalid reply id" });
  }

  db.run(
    `
   UPDATE forum_replies
    SET is_deleted = 1, deleted_at = ?
    WHERE id = ?
      AND is_deleted = 0
      AND (
        member_id = ?
        OR EXISTS (
          SELECT 1
          FROM forum_threads t
          JOIN forum_community_moderators m
            ON m.community_id = t.community_id
          WHERE t.id = forum_replies.thread_id
            AND m.member_id = ?
        )
      )

    `,
    [Date.now(), replyId, req.memberId],
    function (err) {
      if (err) {
        return res.status(500).json({ error: "DB error" });
      }

      if (this.changes === 0) {
        return res.status(403).json({ error: "Not allowed" });
      }
       


      // ==============================
// KARMA ADJUSTMENT: REPLY DELETE
// ==============================
db.get(
  `
  SELECT
    r.member_id AS author_id,
    t.community_id,
    COUNT(a.id) AS amen_count
  FROM forum_replies r
  JOIN forum_threads t ON t.id = r.thread_id
  LEFT JOIN forum_reply_amens a ON a.reply_id = r.id
  WHERE r.id = ?
  GROUP BY r.id
  `,
  [replyId],
  (err2, row) => {
    if (err2 || !row || !row.amen_count) return;

    const delta = -Number(row.amen_count);

    bumpMemberKarma(db, row.author_id, {
      reply: delta,
      total: delta
    });

    bumpCommunityKarma(
      db,
      row.community_id,
      row.author_id,
      {
        reply: delta,
        total: delta
      }
    );
  }
);

      res.json({ success: true });

      logModeratorAction(db, {
        communityId: row.community_id,
        actorId: req.memberId,
        action: "delete_reply",
        targetType: "reply",
        targetId: replyId
      });


    }
  );
});


// --------------------------------------------
// POST /api/forum/threads/:id/lock (AUTHOR ONLY for now)
// --------------------------------------------
router.post("/threads/:id/lock", requireMember, (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: "Invalid thread id" });

  db.get(
    `
    SELECT member_id, community_id
    FROM forum_threads
    WHERE id = ?
    `,
    [id],
    (err, thread) => {
      if (err || !thread)
        return res.status(404).json({ error: "Thread not found" });

      db.get(
        `
        SELECT role
        FROM forum_community_moderators
        WHERE community_id = ? AND member_id = ?
        `,
        [thread.community_id, req.memberId],
        (err2, mod) => {
          const isAuthor = thread.member_id === req.memberId;
          const isMod = !!mod;

          if (!isAuthor && !isMod) {
            return res.status(403).json({ error: "Not authorized" });
          }

          db.run(
            `UPDATE forum_threads SET is_locked = 1 WHERE id = ?`,
            [id],
            function (err3) {
              if (err3) return res.status(500).json({ error: "DB error" });
              res.json({ success: true });

              logModeratorAction(db, {
                communityId: thread.community_id,
                actorId: req.memberId,
                action: "lock_thread",
                targetType: "thread",
                targetId: id
              });

            }
          );
        }
      );
    }
  );
});

// --------------------------------------------
// POST /api/forum/threads/:id/unlock
// --------------------------------------------
// --------------------------------------------
// POST /api/forum/threads/:id/unlock
// --------------------------------------------
router.post("/threads/:id/unlock", requireMember, (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: "Invalid thread id" });

  db.get(
    `
    SELECT member_id, community_id
    FROM forum_threads
    WHERE id = ?
    `,
    [id],
    (err, thread) => {
      if (err || !thread) {
        return res.status(404).json({ error: "Thread not found" });
      }

      db.get(
        `
        SELECT role
        FROM forum_community_moderators
        WHERE community_id = ? AND member_id = ?
        `,
        [thread.community_id, req.memberId],
        (err2, mod) => {
          const isAuthor = thread.member_id === req.memberId;
          const isMod = !!mod;

          if (!isAuthor && !isMod) {
            return res.status(403).json({ error: "Not authorized" });
          }

          db.run(
            `UPDATE forum_threads SET is_locked = 0 WHERE id = ?`,
            [id],
            function (err3) {
              if (err3) return res.status(500).json({ error: "DB error" });
              res.json({ success: true });

              logModeratorAction(db, {
                communityId: thread.community_id,
                actorId: req.memberId,
                action: "unlock_thread",
                targetType: "thread",
                targetId: id
              });
            }
          );
        }
      );
    }
  );
});


// --------------------------------------------
// POST /api/forum/threads/:id/archive (ONE-WAY)
// --------------------------------------------
router.post("/threads/:id/archive", requireMember, (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: "Invalid thread id" });

  db.get(
    `
    SELECT id, community_id
    FROM forum_threads
    WHERE id = ?
    `,
    [id],
    (err, thread) => {
      if (err) return res.status(500).json({ error: "DB error" });
      if (!thread) return res.status(404).json({ error: "Thread not found" });

      db.get(
        `
        SELECT role
        FROM forum_community_moderators
        WHERE community_id = ? AND member_id = ?
        `,
        [thread.community_id, req.memberId],
        (err2, mod) => {
          if (err2) return res.status(500).json({ error: "DB error" });
          if (!mod) return res.status(403).json({ error: "Moderator only" });

          db.run(
            `
            UPDATE forum_threads
            SET is_archived = 1, archived_at = ?
            WHERE id = ? AND is_archived = 0
            `,
            [Date.now(), id],
            function (err3) {
              if (err3) return res.status(500).json({ error: "DB error" });
              if (this.changes === 0)
                return res.status(403).json({ error: "Already archived" });

              res.json({ success: true });

              logModeratorAction(db, {
                communityId: thread.community_id,
                actorId: req.memberId,
                action: "archive_thread",
                targetType: "thread",
                targetId: id
              });

            }
          );
        }
      );
    }
  );
});

// --------------------------------------------
// POST /api/forum/threads/:id/amen  (MEMBER ONLY)
// Toggle amen
// --------------------------------------------
router.post("/threads/:id/amen", requireMember, (req, res) => {
  const threadId = toInt(req.params.id);
  if (!threadId) return res.status(400).json({ error: "Invalid thread id" });

  const memberId = req.memberId;
  const now = Date.now();

  // Guard thread state + get author/community for karma
  db.get(
    `
    SELECT id, member_id AS author_id, community_id, is_locked, is_archived, is_deleted
    FROM forum_threads
    WHERE id = ?
    `,
    [threadId],
    (err0, trow) => {
      if (err0) return res.status(500).json({ error: "DB error" });
      if (!trow) return res.status(404).json({ error: "Thread not found" });
      if (trow.is_deleted) return res.status(403).json({ error: "Thread deleted" });
      if (trow.is_locked || trow.is_archived) {
        return res.status(403).json({ error: "Thread is locked" });
      }

      db.run(
        `
        INSERT OR IGNORE INTO forum_thread_amens (thread_id, member_id, created_at)
        VALUES (?, ?, ?)
        `,
        [threadId, memberId, now],
        function (err1) {
          if (err1) return res.status(500).json({ error: "DB error" });

          const inserted = this.changes === 1;

          const finish = (amened) => {
            db.get(
              `SELECT COUNT(*) AS amen_count FROM forum_thread_amens WHERE thread_id = ?`,
              [threadId],
              (err2, row) => {
                if (err2) return res.status(500).json({ error: "DB error" });
                res.json({ success: true, amened, amen_count: row?.amen_count || 0 });
              }
            );
          };

          // If user is amening their own thread, do NOT award karma (Reddit-style)
          const canAward = Number(trow.author_id) && Number(trow.author_id) !== Number(memberId);

          if (inserted) {
            if (canAward) {
              bumpMemberKarma(db, trow.author_id, { post: +1, total: +1 });
              bumpCommunityKarma(db, trow.community_id, trow.author_id, { post: +1, total: +1 });
            }
            return finish(true);
          }

          // Remove amen
          db.run(
            `DELETE FROM forum_thread_amens WHERE thread_id = ? AND member_id = ?`,
            [threadId, memberId],
            (err3) => {
              if (err3) return res.status(500).json({ error: "DB error" });

              if (canAward) {
                bumpMemberKarma(db, trow.author_id, { post: -1, total: -1 });
                bumpCommunityKarma(db, trow.community_id, trow.author_id, { post: -1, total: -1 });
              }

              finish(false);
            }
          );
        }
      );
    }
  );
});



// --------------------------------------------
// GET /api/forum/threads/:id/replies
// --------------------------------------------
router.get("/threads/:id/replies", requireMemberOptional, (req, res) => {
  const threadId = Number(req.params.id);
  if (!threadId) {
    return res.status(400).json({ error: "Invalid thread id" });
  }


db.all(
  `
  SELECT
    r.id,
    r.thread_id,
    r.member_id,

    CASE
      WHEN r.is_deleted = 1 THEN '[deleted]'
      ELSE r.body
    END AS body,

    r.created_at,

    CASE
      WHEN r.is_deleted = 1 THEN NULL
      ELSE COALESCE(m.first_name, '')
    END AS first_name,

    CASE
      WHEN r.is_deleted = 1 THEN NULL
      ELSE COALESCE(m.last_name, '')
    END AS last_name,

    CASE
      WHEN r.is_deleted = 1 THEN NULL
      ELSE COALESCE(m.avatar_url, m.avatar, NULL)
    END AS avatar_url,

    r.is_deleted,

    (SELECT COUNT(*)
     FROM forum_reply_amens ra
     WHERE ra.reply_id = r.id) AS amen_count,

    CASE
      WHEN ? IS NULL THEN 0
      ELSE EXISTS(
        SELECT 1
        FROM forum_reply_amens ra2
        WHERE ra2.reply_id = r.id
          AND ra2.member_id = ?
      )
    END AS viewer_amened

  FROM forum_replies r
  LEFT JOIN members m ON m.id = r.member_id
  WHERE r.thread_id = ?
  ORDER BY r.created_at ASC
  `,

    [req.memberId || null, req.memberId || null, threadId],
    (err, rows) => {
      if (err) {
        console.error("GET /threads/:id/replies DB error:", err);
        return res.status(500).json({ error: "DB error" });
      }

      res.json({ replies: rows || [] });
    }
  );
});



// --------------------------------------------
// POST /api/forum/threads/:id/replies  (MEMBER ONLY)
// Body: { body }
// --------------------------------------------
router.post("/threads/:id/replies", requireMember, (req, res) => {
  console.log("🔥 USING NEW REPLIES ROUTE");

  const threadId = toInt(req.params.id);
  const body = (req.body?.body || "").trim();

  if (!threadId) return res.status(400).json({ error: "Invalid thread id" });
  if (!body) return res.status(400).json({ error: "Reply body required" });

  const now = Date.now();

 db.run(
  `
  INSERT INTO forum_replies (thread_id, member_id, body, created_at)
  VALUES (?, ?, ?, ?)
  `,
  [threadId, req.memberId, body, now],
  async function (err) {   // ✅ async added
    if (err) {
      console.error("POST /threads/:id/replies DB error:", err);
      return res.status(500).json({ error: "DB error" });
    }

    await runAutoBadges(req.memberId); // ✅ now valid

    
    // ==============================
// MENTIONS (REPLIES)
// ==============================
const mentions = extractMentions(body);

if (mentions.length) {
  db.all(
    `
    SELECT id, username
    FROM members
    WHERE LOWER(username) IN (${mentions.map(() => "?").join(",")})
    `,
    mentions,
    (err, rows) => {
      if (err || !rows?.length) return;

      rows.forEach(m => {
        // Skip self-mentions
        if (m.id === memberId) return;

        db.run(
          `
          INSERT OR IGNORE INTO forum_reply_mentions
            (reply_id, mentioned_member_id, mentioned_by_member_id, created_at)
          VALUES (?, ?, ?, ?)
          `,
          [replyId, m.id, memberId, Date.now()]
        );

        // 🔔 Realtime notification (safe fire-and-forget)
        const ws = globalThis.__hcMemberSockets?.get(m.id);
        if (ws && ws.readyState === 1) {
          ws.send(JSON.stringify({
            type: "mention",
            source: "forum_reply",
            replyId,
            threadId,
            fromMemberId: memberId
          }));
        }
      });
    }
  );
}


    res.status(201).json({
      success: true,
      replyId: this.lastID,
    });
  }
);
});


router.get("/mentions", requireMemberOptional, (req, res) => {
  const q = String(req.query.q || "").trim().toLowerCase();
  if (q.length < 2) return res.json({ results: [] });

  db.all(
    `
    SELECT username
    FROM members
    WHERE username IS NOT NULL
      AND LOWER(username) LIKE ?
    ORDER BY username ASC
    LIMIT 8
    `,
    [`${q}%`],
    (err, rows) => {
      if (err) return res.status(500).json({ error: "DB error" });
      res.json({ results: (rows || []).map(r => r.username) });
    }
  );
});


// GET /api/forum/mention-profile?u=username
// --------------------------------------------
// GET /api/forum/mention-profile
// --------------------------------------------
router.get("/mention-profile", (req, res) => {
  const username = String(req.query.u || "").trim().toLowerCase();
  if (!username) {
    return res.status(400).json({ error: "Missing username" });
  }

  db.get(
    `
    SELECT
      id,
      username,
      first_name,
      last_name,
      avatar_url
    FROM members
    WHERE LOWER(username) = ?
    LIMIT 1
    `,
    [username],
    (err, row) => {
      if (err) return res.status(500).json({ error: "DB error" });
      if (!row) return res.status(404).json({ error: "Member not found" });

      res.json({ member: row });
    }
  );
});




// --------------------------------------------
// POST /api/forum/replies/:id/amen  (MEMBER ONLY)
// Toggle amen on reply
// --------------------------------------------
router.post("/replies/:id/amen", requireMember, (req, res) => {
  const replyId = toInt(req.params.id);
  if (!replyId) return res.status(400).json({ error: "Invalid reply id" });

  const memberId = req.memberId;
  const now = Date.now();

  // Need reply author + thread state + community for karma
  db.get(
    `
    SELECT
      r.id,
      r.member_id AS author_id,
      r.is_deleted AS reply_deleted,
      t.id AS thread_id,
      t.community_id,
      t.is_locked,
      t.is_archived,
      t.is_deleted AS thread_deleted
    FROM forum_replies r
    JOIN forum_threads t ON t.id = r.thread_id
    WHERE r.id = ?
    `,
    [replyId],
    (err0, row) => {
      if (err0) return res.status(500).json({ error: "DB error" });
      if (!row) return res.status(404).json({ error: "Reply not found" });

      if (row.thread_deleted) return res.status(403).json({ error: "Thread deleted" });
      if (row.reply_deleted) return res.status(403).json({ error: "Reply deleted" });
      if (row.is_locked || row.is_archived) {
        return res.status(403).json({ error: "Thread is locked" });
      }

      db.run(
        `
        INSERT OR IGNORE INTO forum_reply_amens (reply_id, member_id, created_at)
        VALUES (?, ?, ?)
        `,
        [replyId, memberId, now],
        function (err1) {
          if (err1) return res.status(500).json({ error: "DB error" });

          const inserted = this.changes === 1;

          const finish = (amened) => {
            db.get(
              `SELECT COUNT(*) AS amen_count FROM forum_reply_amens WHERE reply_id = ?`,
              [replyId],
              (err2, c) => {
                if (err2) return res.status(500).json({ error: "DB error" });
                res.json({ success: true, amened, amen_count: c?.amen_count || 0 });
              }
            );
          };

          const canAward = Number(row.author_id) && Number(row.author_id) !== Number(memberId);

          if (inserted) {
            if (canAward) {
              bumpMemberKarma(db, row.author_id, { reply: +1, total: +1 });
              bumpCommunityKarma(db, row.community_id, row.author_id, { reply: +1, total: +1 });
            }
            return finish(true);
          }

          db.run(
            `DELETE FROM forum_reply_amens WHERE reply_id = ? AND member_id = ?`,
            [replyId, memberId],
            (err3) => {
              if (err3) return res.status(500).json({ error: "DB error" });

              if (canAward) {
                bumpMemberKarma(db, row.author_id, { reply: -1, total: -1 });
                bumpCommunityKarma(db, row.community_id, row.author_id, { reply: -1, total: -1 });
              }

              finish(false);
            }
          );
        }
      );
    }
  );
});

// GET /api/forum/mentions?q=dev
router.get("/mentions", requireMemberOptional, (req, res) => {
  const q = String(req.query.q || "").trim().toLowerCase();
  if (!q || q.length < 2) return res.json({ results: [] });

  db.all(
    `
    SELECT username
    FROM members
    WHERE username IS NOT NULL
      AND LOWER(username) LIKE ?
    ORDER BY username ASC
    LIMIT 8
    `,
    [`${q}%`],
    (err, rows) => {
      if (err) return res.status(500).json({ error: "DB error" });
      res.json({ results: (rows || []).map(r => r.username).filter(Boolean) });
    }
  );
});

// --------------------------------------------
//  API: Forum Analytics
// --------------------------------------------
router.get("/analytics", async (req, res) => {
  try {
    const membersRow = await dbGet(
      `SELECT COUNT(*) AS count FROM members`
    );

    const threadsWeekRow = await dbGet(
      `
      SELECT COUNT(*) AS count
      FROM forum_threads
      WHERE created_at >= strftime('%s','now','-7 days') * 1000
      `
    );

    const activeTodayRow = await dbGet(
      `
      SELECT COUNT(DISTINCT member_id) AS count
      FROM forum_replies
      WHERE created_at >= strftime('%s','now','-1 day') * 1000
      `
    );

    res.json({
      members: membersRow?.count ?? 0,
      threads_week: threadsWeekRow?.count ?? 0,
      active_today: activeTodayRow?.count ?? 0
    });
  } catch (err) {
    console.error("Forum analytics error:", err);
    res.status(500).json({ error: "Analytics unavailable" });
  }
});



// --------------------------------------------
// POST /api/forum/communities (MEMBER ONLY)
// Creates a DRAFT community
// --------------------------------------------
router.post("/communities", requireMember, async (req, res) => {
  try {
    const memberId = req.memberId;
    const { name, description, isPrivate } = req.body || {};

    if (!name || !description) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const result = await dbRun(
      `
      INSERT INTO forum_communities
        (name, description, is_private, status, created_by, created_at)
      VALUES (?, ?, ?, 'draft', ?, ?)
      `,
      [
        String(name).trim(),
        String(description).trim(),
        isPrivate ? 1 : 0,
        memberId,
        Date.now()
      ]
    );

 const communityId = result.lastID;

db.run(
  `
  INSERT INTO forum_community_moderators
    (community_id, member_id, role, created_at)
  VALUES (?, ?, 'owner', ?)
  `,
  [communityId, memberId, Date.now()],
  (err) => {
    if (err) {
      console.error("Failed to auto-assign community owner:", err);
    }
  }
);


    res.json({
      success: true,
      communityId,
      status: "draft"
    });
  } catch (err) {
    console.error("POST /communities error:", err);
    res.status(500).json({ error: "Failed to create community" });
  }
});


// --------------------------------------------
// GET /api/forum/admin/communities (PENDING)
// --------------------------------------------
router.get(
  "/admin/communities",
  requireAdmin,
  async (req, res) => {
    try {
      const rows = await dbAll(`
        SELECT
          c.id,
          c.name,
          c.description,
          c.is_private,
          c.created_at,
          m.name AS creator_name,
          m.email AS creator_email
        FROM forum_communities c
        JOIN members m ON m.id = c.created_by
        WHERE c.status = 'draft'
        ORDER BY c.created_at DESC
      `);

      res.json({ communities: rows });
    } catch (err) {
      console.error("Admin fetch communities failed:", err);
      res.status(500).json({ error: "Failed to load communities" });
    }
  }
);

// --------------------------------------------
// POST /api/forum/admin/communities/:id/decision
// --------------------------------------------
router.post(
  "/admin/communities/:id/decision",
  requireAdmin,
  async (req, res) => {
    const communityId = Number(req.params.id);
    const { decision } = req.body;

    if (!["approved", "rejected"].includes(decision)) {
      return res.status(400).json({ error: "Invalid decision" });
    }

    try {
      // 1️⃣ Update community status
      await dbRun(
        `
        UPDATE forum_communities
        SET status = ?
        WHERE id = ?
        `,
        [decision, communityId]
      );

      // 2️⃣ If approved → seed owner as moderator
      if (decision === "approved") {
        // Get the community creator
        const community = await dbGet(
          `
        SELECT id, created_by AS creator_id
        FROM forum_communities
        WHERE id = ?

          `,
          [communityId]
        );

        if (community && community.creator_id) {
          await dbRun(
            `
            INSERT OR IGNORE INTO forum_community_moderators
              (community_id, member_id, role, created_at)
            VALUES (?, ?, 'owner', ?)
            `,
            [community.id, community.creator_id, Date.now()]
          );
        }
      }

      res.json({ success: true });
    } catch (err) {
      console.error("Community decision failed:", err);
      res.status(500).json({ error: "Decision failed" });
    }
  }
);
// GET /api/forum/communities/:id/rules
router.get("/communities/:id/rules", (req, res) => {
  const communityId = Number(req.params.id);

  db.all(
    `
    SELECT id, title, body
    FROM forum_community_rules
    WHERE community_id = ?
    ORDER BY position ASC, id ASC
    `,
    [communityId],
    (err, rows) => {
      if (err) return res.status(500).json({ error: "DB error" });
      res.json({ rules: rows || [] });
    }
  );
});



// --------------------------------------------
// POST /api/forum/threads/:id/updates
// Add immutable thread update (AUTHOR ONLY)
// --------------------------------------------
router.post("/threads/:id/updates", requireMember, (req, res) => {
  const threadId = Number(req.params.id);
  const memberId = req.memberId;
  const body = (req.body?.body || "").trim();


  if (!threadId) {
    return res.status(400).json({ error: "Invalid thread id" });
  }
  if (!body) {
    return res.status(400).json({ error: "Update body required" });
  }
db.get(
  `SELECT member_id, is_locked, is_archived, is_deleted FROM forum_threads WHERE id = ?`,
  [threadId],
  (err, row) => {
    if (err || !row) return res.status(404).json({ error: "Thread not found" });

    if (row.is_deleted) return res.status(403).json({ error: "Thread deleted" });
    if (row.is_locked || row.is_archived) {
      return res.status(403).json({ error: "Thread is locked" });
    }

    if (row.member_id !== memberId) {
      return res.status(403).json({ error: "Not authorized" });
    }

      db.run(
        `
        INSERT INTO forum_thread_updates
          (thread_id, member_id, body, created_at)
        VALUES (?, ?, ?, ?)
        `,
        [threadId, memberId, body, Date.now()],
        function (err2) {
          if (err2) {
            console.error("Thread update insert failed", err2);
            return res.status(500).json({ error: "DB error" });
          }

          res.status(201).json({
            success: true,
            updateId: this.lastID
          });
        }
      );
    }
  );
});

// --------------------------------------------
// GET /api/forum/threads/:id/updates
// --------------------------------------------
router.get("/threads/:id/updates", requireMemberOptional, (req, res) => {
  const threadId = Number(req.params.id);
  if (!threadId) {
    return res.status(400).json({ error: "Invalid thread id" });
  }

  db.all(
    `
    SELECT
      u.id,
      u.body,
      u.created_at,
      u.member_id
    FROM forum_thread_updates u
    WHERE u.thread_id = ?
    ORDER BY u.created_at ASC
    `,
    [threadId],
    (err, rows) => {
      if (err) {
        console.error("Fetch thread updates failed", err);
        return res.status(500).json({ error: "DB error" });
      }

      res.json({ updates: rows || [] });
    }
  );
});


// =======================================
// JOIN COMMUNITY
// POST /api/forum/communities/:id/join
// =======================================
router.post(
  "/communities/:id/join",
  requireMember,
  (req, res) => {
    const communityId = Number(req.params.id);
    const memberId = req.memberId;

function emitCommunityUpdate(communityId, reason) {
  const room = globalThis.__hcCommunityRooms?.get(Number(communityId));
  if (!room) return;

  const payload = JSON.stringify({
    type: "community:update",
    communityId,
    reason
  });

  room.forEach(ws => {
    if (ws.readyState === 1) {
      ws.send(payload);
    }
  });
}


    if (!communityId) {
      return res.status(400).json({ error: "Invalid community id" });
    }

    db.run(
      `
      INSERT INTO forum_community_members
        (community_id, member_id, status, joined_at)
      VALUES (?, ?, 'active', strftime('%s','now'))
      ON CONFLICT (community_id, member_id)
      DO UPDATE SET
        status = 'active',
        left_at = NULL
      `,

      
      [communityId, memberId],

      
      (err) => {

        emitCommunityUpdate(communityId, "member");

        if (err) {
          console.error("Join community error:", err);
          return res.status(500).json({ error: "DB error" });
        }

        res.json({ joined: true });
      }
    );
  }
);



// =======================================
// LEAVE COMMUNITY
// POST /api/forum/communities/:id/leave
// =======================================
router.post(
  "/communities/:id/leave",
  requireMember,
  (req, res) => {
    const communityId = Number(req.params.id);
    const memberId = req.memberId;

function emitCommunityUpdate(communityId, reason) {
  const room = globalThis.__hcCommunityRooms?.get(Number(communityId));
  if (!room) return;

  const payload = JSON.stringify({
    type: "community:update",
    communityId,
    reason
  });

  room.forEach(ws => {
    if (ws.readyState === 1) {
      ws.send(payload);
    }
  });
}



    if (!communityId) {
      return res.status(400).json({ error: "Invalid community id" });
    }

    db.run(
      `
      UPDATE forum_community_members
      SET status = 'left', left_at = strftime('%s','now')
      WHERE community_id = ? AND member_id = ?
      `,
      [communityId, memberId],

      (err) => {

        emitCommunityUpdate(communityId, "member");

        if (err) {
          console.error("Leave community error:", err);
          return res.status(500).json({ error: "DB error" });
        }

        res.json({ joined: false });
      }
    );
  }
);


export default router;
