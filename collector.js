const { chromium } = require('playwright');
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const SELECTORS = {
  card: '[data-test="vehicle-card"], a[href*="/car-rental/"]',
  title: '[data-test="vehicle-card-title"], h3, [class*="title"]',
  price: '[data-test="vehicle-card-price"], [class*="price"]',
  meta:  '[data-test="vehicle-card-meta"], [class*="rating"], [class*="trips"]'
};

function parseTitle(t) {
  const m = (t || '').match(/(\d{4})\s+([A-Za-z]+)\s+([\w\-]+)\s*(.*)?/);
  return {
    year: m ? Number(m[1]) : null,
    make: m ? m[2] : null,
    model: m ? m[3] : null,
    trim:  m && m[4] ? m[4].trim() : null
  };
}
function numberFromText(x) {
  if (!x) return null;
  const m = String(x).replace(/,/g,'').match(/(\d+(\.\d+)?)/);
  return m ? Number(m[1]) : null;
}

async function upsertListing({ url, make, model, trim, year }) {
  const listing_id = (url || '').split('?')[0];
  await supabase.from('listings').upsert(
    { listing_id, url, make, model, trim, year },
    { onConflict: 'listing_id' }
  );
  return listing_id;
}

async function insertSnapshot({ listing_id, zip, adr, rating, trips, min_days }) {
  await supabase.from('listing_snapshots').insert({ listing_id, zip, adr, rating, trips, min_days });
}

async function collectOne(page, zip, query) {
  const url = `https://turo.com/us/en/search?country=US&itemsPerPage=200&location=${encodeURIComponent(zip)}&q=${encodeURIComponent(query)}`;
  console.log('Visiting', url);
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await sleep(3000);

  const cards = await page.$$(SELECTORS.card);
  console.log('Found cards:', cards.length);

  for (const card of cards) {
    let href = await card.getAttribute('href');
    if (!href) {
      const a = await card.$('a[href*="/car-rental/"]');
      href = a ? await a.getAttribute('href') : null;
    }
    const fullUrl = href ? (href.startsWith('http') ? href : `https://turo.com${href}`) : null;
    if (!fullUrl) continue;

    const titleEl = await card.$(SELECTORS.title);
    const priceEl = await card.$(SELECTORS.price);
    const metaEl  = await card.$(SELECTORS.meta);

    const title = titleEl ? (await titleEl.textContent()) : '';
    const price = priceEl ? (await priceEl.textContent()) : '';
    const meta  = metaEl  ? (await metaEl.textContent())  : '';

    const { year, make, model, trim } = parseTitle(title);
    const adr = numberFromText(price);
    const tripsMatch = (meta || '').match(/(\d+)\s*trips/i);
    const rating = numberFromText(meta);
    const trips = tripsMatch ? Number(tripsMatch[1]) : null;

    const listing_id = await upsertListing({ url: fullUrl, make, model, trim, year });
    await insertSnapshot({ listing_id, zip, adr, rating, trips, min_days: null });

    await sleep(2500); // be gentle
  }
}

async function main() {
  const targets = JSON.parse(fs.readFileSync('targets.json', 'utf-8'));
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();

  // Slow all requests globally
  await context.route('**/*', async (route) => {
    setTimeout(() => route.continue(), 1200);
  });

  const page = await context.newPage();

  for (const t of targets) {
    try {
      console.log('Collecting', t.zip, t.query);
      await collectOne(page, t.zip, t.query);
      await sleep(10000);
    } catch (e) {
      console.error('Error on', t, e.message || e);
    }
  }

  await browser.close();
  console.log('Done.');
}

main().catch((e) => { console.error(e); process.exit(1); });
