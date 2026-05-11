import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import { promisify } from 'util';

const scrypt = promisify(crypto.scrypt);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const bundledDataDir = path.join(__dirname, '..', 'data');
const dataDir = process.env.VERCEL
  ? path.join(os.tmpdir(), 'qa-assured-ai-tool')
  : bundledDataDir;
const dbPath = path.join(dataDir, 'app-data.json');
const bundledDbPath = path.join(bundledDataDir, 'app-data.json');

function createEmptyDb() {
  return {
    users: [],
    sessions: [],
    artifacts: [],
    drafts: [],
  };
}

function ensureDb() {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  if (!fs.existsSync(dbPath)) {
    const initialDb = dbPath !== bundledDbPath && fs.existsSync(bundledDbPath)
      ? JSON.parse(fs.readFileSync(bundledDbPath, 'utf8'))
      : createEmptyDb();

    writeDb(initialDb);
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
