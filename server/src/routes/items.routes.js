// /items routes: public feed, posting, claims, handoffs, and post management.
import { Router } from "express";
import {
  listItems,
  getFormOptions,
  getItem,
  getPhoto,
  getItemForEdit,
  createItem,
  updateItem,
  setStatus,
  markReceived,
  markHandedOff,
  listHistory,
  listMine,
  deleteItem,
} from "../controllers/items.controller.js";
import { claimForm } from "../controllers/claims.controller.js";
import { submitReport } from "../controllers/reports.controller.js";
import {
  requireAuth,
  requireRole,
  requireNonGuest,
} from "../middleware/auth.js";
import { photos } from "../middleware/upload.js";

const router = Router();
router.param("id", (req, res, next, id) =>
  /^\d{1,9}$/.test(id)
    ? next()
    : res.status(400).json({ error: "Invalid item id" }),
);

router.get("/", listItems);
// Static routes must stay above /:id.
router.get("/options", getFormOptions);
router.get("/history", requireAuth, requireRole("security"), listHistory);
router.get("/mine", requireAuth, requireNonGuest, listMine);
router.get("/:id", getItem);
router.get("/:id/photo", getPhoto);
router.get("/:id/questions", requireAuth, requireNonGuest, claimForm);
router.get("/:id/edit", requireAuth, requireNonGuest, getItemForEdit);
router.post("/", requireAuth, requireNonGuest, photos, createItem);
router.post("/:id/report", requireAuth, submitReport);
router.put("/:id", requireAuth, requireNonGuest, updateItem);
router.post("/:id/received", requireAuth, requireRole("security"), markReceived);
router.post("/:id/handed-off", requireAuth, requireRole("security"), markHandedOff);
router.patch("/:id/status", requireAuth, requireRole("security"), setStatus);
router.delete("/:id", requireAuth, requireNonGuest, deleteItem);

export default router;
