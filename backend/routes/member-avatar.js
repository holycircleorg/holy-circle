import express from "express";
import multer from "multer";
import requireMember from "../middleware/requireMember.js";
import cloudinary from "../cloudinary.js";
import db from "../db.js";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post(
  "/avatar",
  requireMember,
  upload.single("avatar"),
  async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const memberId = req.member.id;

    try {
      const result = await new Promise((resolve, reject) => {
        cloudinary.uploader.upload_stream(
          {
            folder: "holy-circle/avatars",
            public_id: `member_${memberId}`,
            overwrite: true,
            transformation: [
              { width: 256, height: 256, crop: "fill", gravity: "face" },
            ],
          },
          (err, result) => {
            if (err) reject(err);
            else resolve(result);
          }
        ).end(req.file.buffer);
      });

      db.run(
        `UPDATE members SET avatar_url = ? WHERE id = ?`,
        [result.secure_url, memberId],
        (err) => {
          if (err) {
            console.error("DB avatar save error:", err);
            return res.status(500).json({ error: "DB error" });
          }

          res.json({ avatar_url: result.secure_url });
        }
      );
    } catch (err) {
      console.error("Avatar upload failed:", err);
      res.status(500).json({ error: "Avatar upload failed" });
    }
  }
);

export default router;
