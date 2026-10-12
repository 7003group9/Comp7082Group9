import multer from 'multer';
import { MAX_PHOTOS, MAX_PHOTO_BYTES, PHOTO_TYPES } from '../services/itemValidation.js';

// Photos are kept in memory (max 3 x 5 MB) and saved to the database with the item.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_PHOTO_BYTES, files: MAX_PHOTOS },
  fileFilter: (req, file, cb) =>
    PHOTO_TYPES.includes(file.mimetype)
      ? cb(null, true)
      : cb(Object.assign(new Error('Photos must be JPEG, PNG, WebP or GIF images'), { photoError: true })),
});

const LIMIT_MESSAGES = {
  LIMIT_FILE_SIZE: `Each photo must be ${MAX_PHOTO_BYTES / 1024 / 1024} MB or smaller`,
  LIMIT_FILE_COUNT: `You can add up to ${MAX_PHOTOS} photos`,
  LIMIT_UNEXPECTED_FILE: `You can add up to ${MAX_PHOTOS} photos`,
};

// Reads up to 3 photos from a multipart form field named "photos" into req.files
// (and the other fields into req.body). JSON requests pass straight through.
// A bad photo gets 400 in the same { error, fields } shape as the other checks.
export function photos(req, res, next) {
  upload.array('photos', MAX_PHOTOS)(req, res, (err) => {
    if (err instanceof multer.MulterError || err?.photoError) {
      const message = LIMIT_MESSAGES[err.code] ?? err.message;
      return res.status(400).json({ error: message, fields: { photos: message } });
    }
    next(err);
  });
}
