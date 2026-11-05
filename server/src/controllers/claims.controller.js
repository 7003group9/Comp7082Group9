import { approveClaim as approveClaimService, listClaimsForReview, submitClaim } from '../services/claims.service.js';

// POST /claims { itemId, answers: [{ questionId, answer }] }.
export async function createClaim(req, res) {
  const { itemId, answers } = req.body ?? {};
  const claim = await submitClaim({ itemId, claimantId: req.user.id, answers });
  res.status(201).json(claim);
}

export async function myClaims(req, res) {
  res.json([]);
}

// POST /claims/:id/decision { decision: "approved" }.
export async function decideClaim(req, res) {
  if (req.body?.decision !== 'approved') {
    return res.status(400).json({ error: 'Only approval is supported by this endpoint' });
  }
  res.json(await approveClaimService(req.params.id));
}

export async function reviewClaims(req, res) {
  res.json(await listClaimsForReview());
}
