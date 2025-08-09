const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const median = (arr) => {
  const a = arr.filter((x) => Number.isFinite(x)).sort((x,y)=>x-y);
  if (!a.length) return null;
  const m = Math.floor(a.length/2);
  return a.length % 2 ? a[m] : (a[m-1]+a[m])/2;
};

async function run() {
  const sinceISO = new Date(Date.now() - 30*24*3600*1000).toISOString();

  const { data: snaps, error } = await supabase
    .from('listing_snapshots')
    .select('listing_id, zip, adr, rating, trips, captured_at, listings ( make, model, year )')
    .gt('captured_at', sinceISO);

  if (error) throw error;

  const buckets = new Map();
  for (const s of snaps || []) {
    const mk = s.listings?.make;
    const md = s.listings?.model;
    const yr = s.listings?.year;
    if (!mk || !md || !yr || !s.zip) continue;
    const key = `${s.zip}|${mk}|${md}|${yr}`;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(s);
  }

  for (const [key, rows] of buckets) {
    const [zip, make, model, yearStr] = key.split('|');
    const year = Number(yearStr);

    const adrs = rows.map(r => r.adr).filter(Number.isFinite);
    const ratings = rows.map(r => r.rating).filter(Number.isFinite);
    const trips = rows.map(r => r.trips).filter(Number.isFinite);

    // avg market days proxy per listing
    const perListing = new Map();
    for (const r of rows) {
      if (!perListing.has(r.listing_id)) perListing.set(r.listing_id, []);
      perListing.get(r.listing_id).push(new Date(r.captured_at).getTime());
    }
    const windows = [];
    for (const [, ts] of perListing) {
      ts.sort((a,b)=>a-b);
      const days = (ts[ts.length-1] - ts[0]) / (1000*3600*24);
      windows.push(days);
    }

    const payload = {
      zip,
      make,
      model,
      year,
      adr_median: median(adrs),
      rating_avg: ratings.length ? (ratings.reduce((a,b)=>a+b,0)/ratings.length) : null,
      trips_median: median(trips),
      avg_market_days: windows.length ? (windows.reduce((a,b)=>a+b,0)/windows.length) : null,
      sample_size: rows.length
    };

    const { error: upErr } = await supabase
      .from('market_baselines')
      .upsert(payload, { onConflict: 'zip,make,model,year' });

    if (upErr) console.error('Upsert error', upErr.message);
  }

  console.log('Aggregation complete.');
}

run().catch((e) => { console.error(e); process.exit(1); });
