import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import { promisify } from 'util';

const scrypt = promisify(crypto.scrypt);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataDir = path.join(__dirname, '..', 'data');
const dbPath = path.join(dataDir, 'app-data.json');

function ensureDb() {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  if (!fs.existsSync(dbPath)) {
    writeDb({
      users: [],
      sessions: [],
      artifacts: [],
      drafts: [],
    });
  }
}

export function readDb() {
  ensureDb();
  return JSON.parse(fs.readFileSync(dbPath, 'utf8'));
}

export function writeDb(db) {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
}

export function createId() {
  return crypto.randomUUID();
}

export async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = await scrypt(password, salt, 64);

  return `${salt}:${derivedKey.toString('hex')}`;
}

export async function verifyPassword(password, passwordHash) {
  const [salt, key] = passwordHash.split(':');
  const derivedKey = await scrypt(password, salt, 64);
  const storedKey = Buffer.from(key, 'hex');

  return storedKey.length === derivedKey.length && crypto.timingSafeEqual(storedKey, derivedKey);
}
