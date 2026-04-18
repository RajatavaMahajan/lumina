import express from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import dotenv from 'dotenv';

interface Product {
  id: string;
  [key: string]: unknown;
}

interface StoreData {
  columns: string[];
  products: Product[];
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

dotenv.config({path: path.join(ROOT_DIR, '.env.local')});
dotenv.config({path: path.join(ROOT_DIR, '.env')});

const DATA_FILE = path.join(ROOT_DIR, 'data', 'store.json');
const PORT = Number(process.env.APP_PORT || 3001);
const APP_AUTH_USERNAME = process.env.APP_AUTH_USERNAME || 'admin';
const APP_AUTH_PASSWORD = process.env.APP_AUTH_PASSWORD || 'admin123';

const app = express();
app.use(express.json({limit: '2mb'}));

const defaultStore: StoreData = {
  columns: ['Product Name', 'Rate'],
  products: [],
};

const unauthorized = (res: express.Response) => {
  return res.status(401).json({error: 'Unauthorized'});
};

const requireAuth: express.RequestHandler = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Basic ')) {
    return unauthorized(res);
  }

  try {
    const encoded = authHeader.slice('Basic '.length);
    const decoded = Buffer.from(encoded, 'base64').toString('utf8');
    const separator = decoded.indexOf(':');

    if (separator < 0) {
      return unauthorized(res);
    }

    const username = decoded.slice(0, separator);
    const password = decoded.slice(separator + 1);

    if (username !== APP_AUTH_USERNAME || password !== APP_AUTH_PASSWORD) {
      return unauthorized(res);
    }

    return next();
  } catch {
    return unauthorized(res);
  }
};

async function ensureStoreFile(): Promise<void> {
  await fs.mkdir(path.dirname(DATA_FILE), {recursive: true});
  try {
    await fs.access(DATA_FILE);
  } catch {
    await fs.writeFile(DATA_FILE, JSON.stringify(defaultStore, null, 2), 'utf8');
  }
}

async function readStore(): Promise<StoreData> {
  await ensureStoreFile();
  const raw = await fs.readFile(DATA_FILE, 'utf8');
  const parsed = JSON.parse(raw);

  if (!Array.isArray(parsed.columns) || !Array.isArray(parsed.products)) {
    return defaultStore;
  }

  return {
    columns: parsed.columns,
    products: parsed.products,
  };
}

async function writeStore(payload: StoreData): Promise<void> {
  const safePayload: StoreData = {
    columns: Array.isArray(payload.columns) ? payload.columns : defaultStore.columns,
    products: Array.isArray(payload.products) ? payload.products : defaultStore.products,
  };
  await fs.writeFile(DATA_FILE, JSON.stringify(safePayload, null, 2), 'utf8');
}

app.get('/api/health', (_req, res) => {
  res.json({ok: true});
});

app.get('/api/data', requireAuth, async (_req, res) => {
  try {
    const data = await readStore();
    res.json(data);
  } catch {
    res.status(500).json({error: 'Failed to read data.'});
  }
});

app.put('/api/data', requireAuth, async (req, res) => {
  try {
    const payload = req.body as Partial<StoreData>;

    if (!payload || !Array.isArray(payload.columns) || !Array.isArray(payload.products)) {
      return res.status(400).json({error: 'Invalid payload.'});
    }

    await writeStore({
      columns: payload.columns,
      products: payload.products,
    });

    return res.json({ok: true});
  } catch {
    return res.status(500).json({error: 'Failed to persist data.'});
  }
});

app.listen(PORT, async () => {
  await ensureStoreFile();
  console.log(`Lumina API listening on http://localhost:${PORT}`);
});
