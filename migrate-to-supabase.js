import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const SUPABASE_URL = 'https://rieffoazbtfcyycrlprh.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJpZWZmb2F6YnRmY3l5Y3JscHJoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0OTA5ODAsImV4cCI6MjA5MjA2Njk4MH0.HFH0GLPB8MVxx7DW_M7JYFxFxVkvychjbKUG9qaG8Do';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function migrate() {
  try {
    // Read store.json
    const storeData = JSON.parse(fs.readFileSync('./data/store.json', 'utf-8'));
    const products = storeData.products;

    console.log(`Starting migration of ${products.length} products...`);

    // Insert products in batches (Supabase recommends batching)
    const batchSize = 100;
    for (let i = 0; i < products.length; i += batchSize) {
      const batch = products.slice(i, i + batchSize).map(p => ({
        id: p.id,
        product_name: p['Product Name'],
        rate: parseFloat(p.Rate)
      }));

      const { error } = await supabase
        .from('products')
        .insert(batch);

      if (error) {
        console.error(`Error inserting batch ${i / batchSize + 1}:`, error);
        return;
      }
      console.log(`✓ Inserted batch ${i / batchSize + 1} (${batch.length} products)`);
    }

    console.log('✅ Migration complete!');
  } catch (error) {
    console.error('Migration failed:', error);
  }
}

migrate();
