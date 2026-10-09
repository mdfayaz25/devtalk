import { randomBytes } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Router } from 'express';
import multer from 'multer';
import { requireAuth } from '../middleware/auth.js';
import { AppError } from '../utils/AppError.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const UPLOAD_DIR = path.resolve(__dirname, '../../uploads');

const ALLOWED = /^(image\/(png|jpe?g|gif|webp)|application\/(pdf|zip|json)|text\/(plain|markdown|csv))$/;

const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (_req, file, cb) => cb(null, `${Date.now().toString(36)}-${randomBytes(6).toString('hex')}${path.extname(file.originalname).toLowerCase().slice(0, 8)}`),
  }),
  limits: { fileSize: 10 * 1024 * 1024, files: 6 },
  fileFilter: (_req, file, cb) => (ALLOWED.test(file.mimetype) ? cb(null, true) : cb(AppError.badRequest(`${file.originalname}: that file type isn't supported`))),
});

const router = Router();

/**
 * Stores files on local disk. In production swap the storage engine for S3 or Cloudinary;
 * the response shape stays the same.
 */
router.post('/', requireAuth, (req, res, next) => {
  upload.array('files', 6)(req, res, (err) => {
    if (err) return next(err instanceof multer.MulterError ? AppError.badRequest(err.code === 'LIMIT_FILE_SIZE' ? 'Files must be 10 MB or smaller' : err.message) : err);
    const files = (req.files as Express.Multer.File[] | undefined) ?? [];
    if (!files.length) return next(AppError.badRequest('Choose a file to upload'));
    res.status(201).json({ files: files.map((f) => ({ url: `/uploads/${f.filename}`, name: f.originalname, size: f.size, mime: f.mimetype })) });
  });
});

export default router;
