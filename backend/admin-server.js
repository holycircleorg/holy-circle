

// =======================
//  AUTH ROUTES
// =======================

// Registration
app.post("/api/admin/auth/register", async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password required." });
    }

    const existing = await getUserByEmail(email);
    if (existing) {
      return res.status(400).json({ error: "Email already registered." });
    }

    const hash = await bcrypt.hash(password, 10);
    const now = Date.now();

    db.run(
      "INSERT INTO users (name, email, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?)",
      [name || "", email, hash, role || "admin", now],
      function (err) {
        if (err) return res.status(500).json({ error: "DB error" });

        const user = {
          id: this.lastID,
          email,
          role: role || "admin",
        };
        const token = createToken(user);

        // Fire-and-forget admin welcome email
        sendGenericEmail({
          to: email,
          subject: "Welcome to the Holy Circle Admin Dashboard",
          html: `
            <div style="font-family:Poppins,sans-serif;color:#002e6b;padding:20px;">
              <h2 style="color:#bf9745;">Welcome to Holy Circle — Let’s Build God’s Kingdom Together</h2>
              <p>Hi ${name || "there"},</p>
              <p>
                Your Holy Circle admin account has been created. You can now log in to the
                admin dashboard to manage content, members, donations, and events.
              </p>
              <p>
                Please keep your login credentials secure and do not share them with anyone.
              </p>
              <br>
              —
              <br>
              In Christ,<br>
              The Holy Circle Team<br>
              <a href="mailto:info@holycircle.org">info@holycircle.org</a><br>
              <a href="https://www.holycircle.org">www.holycircle.org</a>
            </div>
          `,
          text: `
        Welcome to Holy Circle — Let’s Build God’s Kingdom Together

        Hi ${name || "there"},

        Your Holy Circle admin account has been created. You can now log in to the admin dashboard to manage content, members, donations, and events.

        Please keep your login credentials secure and do not share them with anyone.

        In Christ,
        The Holy Circle Team
        info@holycircle.org
        www.holycircle.org
          `.trim(),
        }).catch((err) => {
          console.error("Admin welcome email failed:", email, err);
        });

        res
          .cookie("hc_admin_token", token, {
            httpOnly: true,
            sameSite: "lax",
            secure: false, // true in prod with HTTPS
          })
          .json({ message: "Registered", user });
      }
    );
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Server error" });
  }
});

// Login
app.post("/api/admin/auth/login", async (req, res) => {
  try {
    const { email, password, twofaCode } = req.body;
    const user = await getUserByEmail(email);
    if (!user) return res.status(400).json({ error: "Invalid credentials" });

    const now = Date.now();
    if (user.lock_until && now < user.lock_until) {
      return res.status(423).json({
        error: "Account locked due to failed attempts. Try again later.",
      });
    }

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      await updateFailedAttempt(user, false);
      return res.status(400).json({ error: "Invalid credentials" });
    }

    // If 2FA enabled, require code
    if (user.twofa_enabled) {
      if (!twofaCode) {
        return res.status(200).json({ twofaRequired: true });
      }

      const verified = speakeasy.totp.verify({
        secret: user.twofa_secret,
        encoding: "base32",
        token: twofaCode,
        window: 1,
      });

      if (!verified) {
        return res.status(400).json({ error: "Invalid 2FA code" });
      }
    }

    await updateFailedAttempt(user, true);

    const token = createToken(user);

    res
      .cookie("hc_admin_token", token, {
        httpOnly: true,
        sameSite: "lax",
        secure: false,
      })
      .json({
        message: "Logged in",
        user: { id: user.id, email: user.email, role: user.role },
      });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Server error" });
  }
});

// Me
app.get("/api/admin/auth/me", authRequired, (req, res) => {
  db.get(
    "SELECT id, email, role, name FROM users WHERE id = ?",
    [req.user.id],
    (err, row) => {
      if (err || !row) return res.status(404).json({ error: "User not found" });
      res.json({ user: row });
    }
  );
});

// Logout
app.post("/api/admin/auth/logout", (req, res) => {
  res.clearCookie("hc_admin_token").json({ message: "Logged out" });
});

// Enable 2FA
app.post("/api/admin/auth/2fa/setup", authRequired, (req, res) => {
  const secret = speakeasy.generateSecret({
    name: "Holy Circle Admin",
  });

  db.run(
    "UPDATE users SET twofa_secret = ?, twofa_enabled = 0 WHERE id = ?",
    [secret.base32, req.user.id],
    (err) => {
      if (err) return res.status(500).json({ error: "DB error" });

      res.json({
        secret: secret.base32,
        otpauth_url: secret.otpauth_url,
      });
    }
  );
});

// Confirm 2FA
app.post("/api/admin/auth/2fa/confirm", authRequired, (req, res) => {
  const { token } = req.body;

  db.get(
    "SELECT twofa_secret FROM users WHERE id = ?",
    [req.user.id],
    (err, user) => {
      if (err || !user || !user.twofa_secret) {
        return res.status(400).json({ error: "No 2FA setup found" });
      }

      const verified = speakeasy.totp.verify({
        secret: user.twofa_secret,
        encoding: "base32",
        token,
        window: 1,
      });

      if (!verified) {
        return res.status(400).json({ error: "Invalid 2FA token" });
      }

      db.run(
        "UPDATE users SET twofa_enabled = 1 WHERE id = ?",
        [req.user.id],
        (err2) => {
          if (err2) return res.status(500).json({ error: "DB error" });
          res.json({ message: "2FA enabled" });
        }
      );
    }
  );
});

// Request password reset
app.post("/api/admin/auth/request-reset", (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: "Email required" });

  db.get("SELECT id FROM users WHERE email = ?", [email], (err, user) => {
    if (err) return res.status(500).json({ error: "DB error" });
    if (!user) return res.json({ message: "If account exists, email sent." });

    const token = crypto.randomBytes(32).toString("hex");
    const expires = Date.now() + 60 * 60 * 1000; // 1 hour

       db.run(
      "INSERT INTO password_resets (user_id, token, expires_at) VALUES (?, ?, ?)",
      [user.id, token, expires],
      async (err2) => {
        if (err2) return res.status(500).json({ error: "DB error" });

        const resetUrl = `${CLIENT_ORIGIN}/admin-reset-password.html?token=${token}`;

        try {
          await sendGenericEmail({
            to: email,
            subject: "Reset your Holy Circle Admin password",
            html: `
              <div style="font-family:Poppins,sans-serif;color:#002e6b;padding:20px;">
                <h2 style="color:#bf9745;">Reset Your Holy Circle Admin Password</h2>
                <p>We received a request to reset your Holy Circle admin password.</p>
                <p>
                  <a href="${resetUrl}"
                     style="display:inline-block;padding:10px 18px;background:#bf9745;color:#fff;text-decoration:none;border-radius:6px;">
                    Reset Password
                  </a>
                </p>
                <p>If you did not request this, you can safely ignore this email.</p>
                <br>
                —
                <br>
                In Christ,<br>
                The Holy Circle Team<br>
                <a href="mailto:info@holycircle.org">info@holycircle.org</a><br>
                <a href="https://www.holycircle.org">www.holycircle.org</a>
              </div>
            `,
            text: `
We received a request to reset your Holy Circle admin password.

Reset your password: ${resetUrl}

If you did not request this, you can safely ignore this email.

In Christ,
The Holy Circle Team
info@holycircle.org
www.holycircle.org
            `.trim(),
          });
        } catch (emailErr) {
          console.error("Error sending admin reset email:", emailErr);
          // Still return generic success for security
        }

        res.json({ message: "If account exists, email sent." });
      }
    );

  });
});

// Reset password
app.post("/api/admin/auth/reset-password", (req, res) => {
  const { token, password } = req.body;
  if (!token || !password) {
    return res
      .status(400)
      .json({ error: "Token and new password required." });
  }

  db.get(
    "SELECT * FROM password_resets WHERE token = ? AND used = 0",
    [token],
    async (err, row) => {
      if (err || !row) {
        return res.status(400).json({ error: "Invalid or used token." });
      }

      if (Date.now() > row.expires_at) {
        return res.status(400).json({ error: "Token expired." });
      }

      const hash = await bcrypt.hash(password, 10);

      db.run(
        "UPDATE users SET password_hash = ? WHERE id = ?",
        [hash, row.user_id],
        (err2) => {
          if (err2) return res.status(500).json({ error: "DB error" });

          db.run(
            "UPDATE password_resets SET used = 1 WHERE id = ?",
            [row.id],
            (err3) => {
              if (err3) return res.status(500).json({ error: "DB error" });
              res.json({ message: "Password updated." });
            }
          );
        }
      );
    }
  );
});
