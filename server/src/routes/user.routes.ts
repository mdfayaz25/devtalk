import { Router } from 'express';
import { z } from 'zod';
import { User } from '../models/User.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { onlineIds } from '../lib/realtime.js';

const router = Router();
router.use(requireAuth);

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

router.get(
  '/',
  validate({ query: z.object({ search: z.string().trim().max(60).optional() }) }),
  asyncHandler(async (req, res) => {
    const q = req.query.search ? new RegExp(escapeRegex(String(req.query.search)), 'i') : null;
    const users = await User.find({ _id: { $ne: req.user!.id }, ...(q && { $or: [{ name: q }, { email: q }, { title: q }] }) })
      .sort({ name: 1 })
      .limit(30)
      .select('name email avatarColor title lastSeen');
    const on = new Set(onlineIds());
    res.json({ users: users.map((u) => ({ ...u.toJSON(), online: on.has(u.id) })) });
  }),
);

export default router;
