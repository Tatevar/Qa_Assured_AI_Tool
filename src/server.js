import 'dotenv/config';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import cors from 'cors';
import artifactRoutes from './routes/artifactRoutes.js';
import authRoutes from './routes/authRoutes.js';
import qaRoutes from './routes/qaRoutes.js';
import { attachUser } from './middleware/auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicPath = path.join(__dirname, '..', 'public');

const app = express();
const port = process.env.PORT || 3000;
const host = process.env.HOST || '127.0.0.1';

app.use(cors({
  origin: true,
  credentials: true,
}));
app.use(express.json({ limit: '1mb' }));
app.use(attachUser);
app.use(express.static(publicPath));

app.get('/', (req, res) => {
  res.sendFile(path.join(publicPath, 'index.html'));
});

app.use('/api/qa', qaRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/artifacts', artifactRoutes);

app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.originalUrl} does not exist.`,
  });
});

app.use((err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  const response = {
    error: err.name || 'InternalServerError',
    message: err.message || 'Something went wrong.',
  };

  if (err.details) {
    response.details = err.details;
  }

  res.status(statusCode).json(response);
});

const server = app.listen(port, host, () => {
  console.log(`QA Assured AI Tool API listening at http://${host}:${port}`);
});

server.on('error', (err) => {
  console.error(`Failed to start server on http://${host}:${port}: ${err.message}`);
  process.exit(1);
});
