import { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

interface Product {
  id: string;
  [key: string]: unknown;
}

interface StoreData {
  columns: string[];
  products: Product[];
}

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || '';
const APP_AUTH_USERNAME = process.env.APP_AUTH_USERNAME || 'admin';
const APP_AUTH_PASSWORD = process.env.APP_AUTH_PASSWORD || 'admin123';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const unauthorized = (res: VercelResponse) => {
  return res.status(401).json({ error: 'Unauthorized' });
};

function checkAuth(req: VercelRequest, res: VercelResponse): boolean {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Basic ')) {
    unauthorized(res);
    return false;
  }

  try {
    const encoded = authHeader.slice('Basic '.length);
    const decoded = Buffer.from(encoded, 'base64').toString('utf8');
    const separator = decoded.indexOf(':');

    if (separator < 0) {
      unauthorized(res);
      return false;
    }

    const username = decoded.slice(0, separator);
    const password = decoded.slice(separator + 1);

    if (username !== APP_AUTH_USERNAME || password !== APP_AUTH_PASSWORD) {
      unauthorized(res);
      return false;
    }

    return true;
  } catch {
    unauthorized(res);
    return false;
  }
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  // Check authentication
  if (!checkAuth(req, res)) {
    return;
  }

  if (req.method === 'GET') {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('created_at', { ascending: true });

      if (error) {
        return res.status(500).json({ error: 'Failed to fetch products' });
      }

      // Transform Supabase format to app format
      const products: Product[] = (data || []).map((row: any) => ({
        id: row.id,
        'Product Name': row.product_name,
        Rate: row.rate,
      }));

      const storeData: StoreData = {
        columns: ['Product Name', 'Rate'],
        products,
      };

      return res.status(200).json(storeData);
    } catch (error) {
      return res.status(500).json({ error: 'Failed to read data' });
    }
  }

  if (req.method === 'PUT') {
    try {
      const payload = req.body as Partial<StoreData>;

      if (!payload || !Array.isArray(payload.products)) {
        return res.status(400).json({ error: 'Invalid payload' });
      }

      // Transform app format to Supabase format and upsert
      const productsToUpsert = payload.products.map((p: any) => ({
        id: p.id,
        product_name: p['Product Name'],
        rate: parseFloat(p.Rate),
      }));

      // Delete all existing products and insert new ones
      // (or use upsert if all products have IDs)
      const { error: deleteError } = await supabase
        .from('products')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // This deletes all rows

      if (deleteError) {
        console.error('Delete error:', deleteError);
      }

      const { error: insertError } = await supabase
        .from('products')
        .insert(productsToUpsert);

      if (insertError) {
        return res.status(500).json({ error: 'Failed to update products' });
      }

      return res.status(200).json({ ok: true });
    } catch (error) {
      console.error('PUT error:', error);
      return res.status(500).json({ error: 'Failed to persist data' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
