import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { createId, readDb, writeDb } from '../storage.js';

const router = Router();

router.use(requireAuth);

router.get('/', (req, res) => {
  const db = readDb();
  const artifacts = db.artifacts
    .filter((artifact) => artifact.userId === req.user.id)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 30);

  res.json({
    artifacts,
  });
});

router.post('/', (req, res) => {
  const { key, label, title, text, taskDescription, additionalContext, clarificationAnswers } = req.body || {};

  if (typeof key !== 'string' || typeof text !== 'string' || !text.trim()) {
    return res.status(400).json({
      error: 'ValidationError',
      message: 'Artifact key and text are required.',
    });
  }

  const db = readDb();
  const artifact = {
    id: createId(),
    userId: req.user.id,
    key,
    label: typeof label === 'string' ? label : key,
    title: typeof title === 'string' && title.trim() ? title.trim() : label || key,
    text,
    taskDescription: typeof taskDescription === 'string' ? taskDescription : '',
    additionalContext: typeof additionalContext === 'string' ? additionalContext : '',
    clarificationAnswers: typeof clarificationAnswers === 'string' ? clarificationAnswers : '',
    createdAt: new Date().toISOString(),
  };

  db.artifacts.push(artifact);
  writeDb(db);

  res.status(201).json({
    artifact,
  });
});

router.delete('/:id', (req, res) => {
  const db = readDb();
  const originalCount = db.artifacts.length;

  db.artifacts = db.artifacts.filter((artifact) => {
    return !(artifact.id === req.params.id && artifact.userId === req.user.id);
  });
  writeDb(db);

  if (db.artifacts.length === originalCount) {
    return res.status(404).json({
      error: 'NotFound',
      message: 'Artifact not found.',
    });
  }

  return res.json({
    message: 'Artifact deleted.',
  });
});

router.get('/draft/current', (req, res) => {
  const db = readDb();
  const draft = db.drafts.find((item) => item.userId === req.user.id);

  res.json({
    draft: draft || null,
  });
});

router.put('/draft/current', (req, res) => {
  const db = readDb();
  const payload = {
    taskDescription: typeof req.body?.taskDescription === 'string' ? req.body.taskDescription : '',
    additionalContext: typeof req.body?.additionalContext === 'string' ? req.body.additionalContext : '',
    clarificationAnswers: typeof req.body?.clarificationAnswers === 'string' ? req.body.clarificationAnswers : '',
  };
  const existingDraft = db.drafts.find((item) => item.userId === req.user.id);

  if (existingDraft) {
    Object.assign(existingDraft, payload, {
      updatedAt: new Date().toISOString(),
    });
  } else {
    db.drafts.push({
      id: createId(),
      userId: req.user.id,
      ...payload,
      updatedAt: new Date().toISOString(),
    });
  }

  writeDb(db);

  res.json({
    draft: db.drafts.find((item) => item.userId === req.user.id),
  });
});

export default router;
