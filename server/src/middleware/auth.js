// TODO: verify the school-login token (Authorization: Bearer <token>)
// and set req.user = { id, role }.
export function requireAuth(req, res, next) {
  res.status(501).json({ error: 'Auth not implemented yet' });
}
