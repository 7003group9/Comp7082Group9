// /items routes: public list, single item, posting (with photos), and managing your own posts.
import { Router } from "express";
import {
  listItems,
  getFormOptions,
  getItem,
  getPhoto,
  getItemForEdit,
  createItem,
  updateItem,
  markReceived,
  markHandedOff,
  listHistory,
  listMine,
  deleteItem,
} from "../controllers/items.controller.js";
import { claimForm } from "../controllers/claims.controller.js";
import {
  requireAuth,
  requireRole,
  requireNonGuest,
} from "../middleware/auth.js";
import { photos } from "../middleware/upload.js";

const router = Router();
// A non-numeric id (/items/abc) is the caller's mistake: 400, not a database error.
router.param("id", (req, res, next, id) =>
  /^\d{1,9}$/.test(id)
    ? next()
    : res.status(400).json({ error: "Invalid item id" }),
);

router.get("/", listItems);
// '/options', '/mine' and '/history' must stay above '/:id'.
router.get("/options", getFormOptions);
router.get("/history", requireAuth, requireRole("security"), listHistory);
router.get("/mine", requireAuth, requireNonGuest, listMine);
router.get("/:id", getItem);
router.get("/:id/photo", getPhoto);
router.get("/:id/questions", requireAuth, claimForm);
router.get("/:id/edit", requireAuth, requireNonGuest, getItemForEdit);
router.post("/", requireAuth, requireNonGuest, photos, createItem);
router.put("/:id", requireAuth, requireNonGuest, updateItem);
router.post(
  "/:id/received",
  requireAuth,
  requireRole("security"),
  markReceived,
);
router.post(
  "/:id/handed-off",
  requireAuth,
  requireRole("security"),
  markHandedOff,
);
router.delete("/:id", requireAuth, requireNonGuest, deleteItem);

export default router;
