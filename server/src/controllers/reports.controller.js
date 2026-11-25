import {
  createReport,
  dismissReport,
  hideReportedPost,
  listOpenReports,
} from '../services/reports.service.js';

export async function submitReport(req, res) {
  const itemId = Number(req.params.id);
  if (!Number.isInteger(itemId) || itemId <= 0) {
    return res.status(400).json({ error: 'Invalid item id' });
  }
  const reason = String(req.body?.reason ?? '').trim();
  if (!reason) return res.status(400).json({ error: 'A reason is required.' });

  const report = await createReport({
    itemId,
    reporterId: req.user.id,
    reason,
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

export async function dismissReports(req, res) {
  await dismissReport(Number(req.params.id), req.user.id);
  res.json({ ok: true, itemId: Number(req.params.id), action: 'dismissed' });
}
