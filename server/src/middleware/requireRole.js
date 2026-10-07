// Route guard: requireRole('security') lets only that role through.
// Use after requireAuth, which sets req.user.
export const requireRole = (role) => (req, res, next) => {
  if (req.user?.role !== role) return res.status(403).json({ error: 'Not allowed' });
  next();
};
