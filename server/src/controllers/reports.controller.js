import {
  createReport,
  dismissReport,
  hideReportedPost,
  listOpenReports,
  unhidePost as unhide,
} from '../services/reports.service.js';

// POST /items/:id/report { reason, details? }. The route has already checked the id is a
// number; createReport checks the reason is one of REPORT_REASONS (400 otherwise).
export async function submitReport(req, res) {
  const report = await createReport({
    itemId: Number(req.params.id),
    reporterId: req.user.id,
    reason: String(req.body?.reason ?? '').trim(),
    details: req.body?.details,
  });
  res.status(201).json({ ok: true, report });
}

export async function moderationQueue(req, res) {
  res.json(await listOpenReports());
}

export async function hidePost(req, res) {
  await hideReportedPost(Number(req.params.id), req.user.id);
  res.json({ ok: true, itemId: Number(req.params.id), action: 'hidden' });
}

// POST /reports/:id/unhide: puts a hidden post back, and reopens the claims the hide closed.
export async function unhidePost(req, res) {
  const reopened = await unhide(Number(req.params.id));
  res.json({ ok: true, itemId: Number(req.params.id), action: 'unhidden', reopenedClaims: reopened });
}

export async function dismissReports(req, res) {
  await dismissReport(Number(req.params.id), req.user.id);
  res.json({ ok: true, itemId: Number(req.params.id), action: 'dismissed' });
}
