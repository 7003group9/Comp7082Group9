// /items routes: public feed, posting, drafts, claims, handoffs, and post management.
import { Router } from "express";
import {
  listItems,
  getItems,
  getFormOptions,
  getItem,
  getItemForEdit,
  editItem,
  createItem,
  updateItem,
  markReceived,
  markHandedOff,
  listHistory,
  listMine,
  deleteItem,
  getDraft,
  saveDraft,
  deleteDraft,
} from "../controllers/items.controller.js";
import { claimForm } from "../controllers/claims.controller.js";
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
// Backward-compatible endpoint for the earlier query parameter API.
router.get("/list", getItems);
// Static routes must stay above /:id.
router.get("/options", getFormOptions);
router.get("/draft", requireAuth, requireNonGuest, getDraft);
router.put("/draft", requireAuth, requireNonGuest, saveDraft);
router.delete("/draft", requireAuth, requireNonGuest, deleteDraft);
router.get("/history", requireAuth, requireRole("security"), listHistory);
router.get("/mine", requireAuth, requireNonGuest, listMine);
router.get("/:id", getItem);
router.get("/:id/questions", requireAuth, claimForm);
router.get("/:id/edit", requireAuth, requireNonGuest, getItemForEdit);
router.post("/", requireAuth, requireNonGuest, photos, createItem);
router.put("/:id", requireAuth, requireNonGuest, updateItem);
router.post("/:id/received", requireAuth, requireRole("security"), markReceived);
router.post("/:id/handed-off", requireAuth, requireRole("security"), markHandedOff);
router.delete("/:id", requireAuth, requireNonGuest, deleteItem);

export default router;
