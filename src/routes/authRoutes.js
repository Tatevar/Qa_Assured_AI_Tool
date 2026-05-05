import { Router } from 'express';
import crypto from 'crypto';
import { SESSION_COOKIE_NAME, requireAuth } from '../middleware/auth.js';
import { createId, hashPassword, readDb, verifyPassword, writeDb } from '../storage.js';

const router = Router();
const sessionMaxAgeMs = 1000 * 60 * 60 * 24 * 30;

function normalizeEmail(email) {
  return typeof email === 'string' ? email.trim().toLowerCase() : '';
}

function validateCredentials(req, res, next) {
  const email = normalizeEmail(req.body?.email);
  const password = req.body?.password;

  if (!email || !email.includes('@')) {
    return res.status(400).json({
      error: 'ValidationError',
      message: 'A valid email is required.',
    });
  }

  if (typeof password !== 'string' || password.length < 8) {
    return res.status(400).json({
      error: 'ValidationError',
      message: 'Password must be at least 8 characters.',
    });
  }

  req.credentials = { email, password };
  return next();
}

function setSessionCookie(res, token) {
  res.cookie(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.COOKIE_SECURE === 'true',
    maxAge: sessionMaxAgeMs,
    path: '/',
  });
}

function createSession(db, userId) {
  const token = crypto.randomBytes(32).toString('hex');
  const session = {
    id: createId(),
    userId,
    token,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + sessionMaxAgeMs).toISOString(),
  };

  db.sessions = db.sessions.filter((item) => new Date(item.expiresAt) > new Date());
  db.sessions.push(session);

  return session;
}

router.post('/register', validateCredentials, async (req, res, next) => {
  try {
    const { email, password } = req.credentials;
    const db = readDb();

    if (db.users.some((user) => user.email === email)) {
      return res.status(409).json({
        error: 'Conflict',
        message: 'An account with this email already exists.',
      });
    }

    const user = {
      id: createId(),
      email,
      passwordHash: await hashPassword(password),
      createdAt: new Date().toISOString(),
    };
    db.users.push(user);

    const session = createSession(db, user.id);
    writeDb(db);
    setSessionCookie(res, session.token);

    return res.status(201).json({
      user: {
        id: user.id,
        email: user.email,
      },
    });
  } catch (err) {
    return next(err);
  }
});

router.post('/login', validateCredentials, async (req, res, next) => {
  try {
    const { email, password } = req.credentials;
    const db = readDb();
    const user = db.users.find((item) => item.email === email);

    if (!user) {
      return res.status(404).json({
        error: 'NotFound',
        message: 'No account exists for this email. Register first, then login.',
      });
    }

    if (!(await verifyPassword(password, user.passwordHash))) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Incorrect password.',
      });
    }

    const session = createSession(db, user.id);
    writeDb(db);
    setSessionCookie(res, session.token);

    return res.json({
      user: {
        id: user.id,
        email: user.email,
      },
    });
  } catch (err) {
    return next(err);
  }
});

router.post('/logout', requireAuth, (req, res) => {
  const db = readDb();
  db.sessions = db.sessions.filter((session) => session.token !== req.sessionToken);
  writeDb(db);

  res.clearCookie(SESSION_COOKIE_NAME, {
    path: '/',
  });
  res.json({
    message: 'Logged out.',
  });
});

router.get('/me', (req, res) => {
  res.json({
    user: req.user || null,
  });
});

export default router;
