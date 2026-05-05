import { readDb } from '../storage.js';

export const SESSION_COOKIE_NAME = 'qa_session';

function parseCookies(cookieHeader = '') {
  return cookieHeader
    .split(';')
    .map((cookie) => cookie.trim())
    .filter(Boolean)
    .reduce((cookies, cookie) => {
      const separatorIndex = cookie.indexOf('=');

      if (separatorIndex === -1) {
        return cookies;
      }

      const key = decodeURIComponent(cookie.slice(0, separatorIndex));
      const value = decodeURIComponent(cookie.slice(separatorIndex + 1));
      cookies[key] = value;

      return cookies;
    }, {});
}

export function attachUser(req, res, next) {
  const cookies = parseCookies(req.headers.cookie);
  const token = cookies[SESSION_COOKIE_NAME];

  if (!token) {
    return next();
  }

  const db = readDb();
  const session = db.sessions.find((item) => item.token === token);

  if (!session || new Date(session.expiresAt) <= new Date()) {
    return next();
  }

  const user = db.users.find((item) => item.id === session.userId);

  if (user) {
    req.user = {
      id: user.id,
      email: user.email,
    };
    req.sessionToken = token;
  }

  return next();
}

export function requireAuth(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'You must be logged in to use this endpoint.',
    });
  }

  return next();
}
