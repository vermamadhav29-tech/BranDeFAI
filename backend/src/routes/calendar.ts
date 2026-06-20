import { Router } from "express";
import { authMiddleware } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { autoAssignSchema, createEntrySchema, updateEntrySchema } from "../middleware/validators/calendarSchemas";
import {
  autoAssign,
  createEntry,
  getCalendar,
  getStats,
  updateEntry,
  deleteEntry,
  downloadPDF,
  downloadCSV,
} from "../controllers/calendarController";

const router = Router();
router.use(authMiddleware);

// Static routes before /:id to prevent param collision
router.post("/auto-assign", validate(autoAssignSchema), autoAssign);
router.get("/stats", getStats);
router.get("/export/pdf", downloadPDF);
router.get("/export/csv", downloadCSV);
router.get("/", getCalendar);
router.post("/entry", validate(createEntrySchema), createEntry);
router.put("/entry/:id", validate(updateEntrySchema), updateEntry);
router.delete("/entry/:id", deleteEntry);

export default router;
