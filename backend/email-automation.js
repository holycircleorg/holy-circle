// FILE: backend/email-automation.js
import db from "./db.js";

// Generic function: called whenever a trigger happens
export function enqueueAutomationForTrigger(triggerType, context = {}) {
  const { memberId, emailSignupId, donorId, eventId } = context;
  const now = Date.now();

  // 1) Find active sequences for this trigger
  db.all(
    `
    SELECT id
    FROM email_automation_sequences
    WHERE trigger_type = ?
      AND active = 1
  `,
    [triggerType],
    (err, seqs) => {
      if (err) {
        console.error("Automation: load sequences error:", err);
        return;
      }
      if (!seqs || seqs.length === 0) return;

      seqs.forEach((seq) => {
        const sequenceId = seq.id;

        // 2) Load steps
        db.all(
          `
          SELECT id, delay_days
          FROM email_automation_steps
          WHERE sequence_id = ?
          ORDER BY step_order ASC
        `,
          [sequenceId],
          (err2, steps) => {
            if (err2) {
              console.error("Automation: load steps error:", err2);
              return;
            }
            if (!steps || steps.length === 0) return;

            const stmt = db.prepare(`
              INSERT INTO email_automation_queue
                (sequence_id, step_id, member_id, email_signup_id, donor_id, event_id, run_at, status, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?)
            `);

            steps.forEach((step) => {
              const runAt =
                now + Number(step.delay_days || 0) * 24 * 60 * 60 * 1000;

              stmt.run(
                sequenceId,
                step.id,
                memberId || null,
                emailSignupId || null,
                donorId || null,
                eventId || null,
                runAt,
                now
              );
            });

            stmt.finalize((err3) => {
              if (err3) {
                console.error("Automation: enqueue error:", err3);
              }
            });
          }
        );
      });
    }
  );
}
