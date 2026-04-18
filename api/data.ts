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

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
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

      if (payload.products.length === 0) {
        return res.status(400).json({ error: 'Refusing to replace data with an empty product list.' });
      }

      // Transform app format to Supabase format and upsert
      const productsToUpsert = payload.products.map((p: any) => ({
        id: p.id,
        product_name: p['Product Name'],
        rate: parseFloat(p.Rate),
      }));

      // Delete all existing products and insert new ones
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
