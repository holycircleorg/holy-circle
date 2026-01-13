// backend/routes/email.js
import express from "express";
import { enqueueAutomationForTrigger } from "../email-automation.js";

const router = express.Router();

/**
 * INTERNAL USE
 * Other routes import this function
 */
export function triggerEmailAutomation(triggerType, context = {}) {
  enqueueAutomationForTrigger(triggerType, context);
}

export default router;
