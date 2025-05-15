const fs = require('fs');
const path = require('path');
const unzipper = require('unzipper');
const readline = require('readline');
const dayjs = require('dayjs');

const GDELT_UPDATE_LIST_URL = 'http://data.gdeltproject.org/gdeltv2/lastupdate.txt';
const OUTPUT_CSV = 'gdelt-mirror.csv';

async function getLatestExportUrl(fetch) {
  const res = await fetch(GDELT_UPDATE_LIST_URL);
  const text = await res.text();
  const lines = text.trim().split('\n');
  for (let line of lines) {
    if (line.endsWith('.export.CSV.zip')) {
      const parts = line.trim().split(' ');
      const url = parts[2];
      return url;
    }
  }
  throw new Error('No export file found in GDELT update list');
}

async function downloadAndFilterGdelt(url, fetch) {
  console.log(`📥 Downloading: ${url}`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch: ${res.statusText}`);

  const directory = await unzipper.Open.buffer(await res.buffer());
  const csvFile = directory.files.find(file => file.path.endsWith('.CSV'));
  if (!csvFile) throw new Error('No CSV file found in zip');

  const readStream = csvFile.stream();
  const rl = readline.createInterface({ input: readStream });

  const output = fs.createWriteStream(OUTPUT_CSV);
  output.write('SQLDATE,Actor1CountryCode,Actor2CountryCode,AvgTone,GoldsteinScale,EventCode,EventRootCode,NumArticles\n');

  for await (const line of rl) {
    const cols = line.split('\t');
    const sqlDate = cols[1];
    const actor1 = cols[7];
    const actor2 = cols[17];
    const avgTone = cols[34];
    const goldstein = cols[30];
    const eventCode = cols[26];
    const eventRootCode = cols[27];
    const numArticles = cols[31];

    if (sqlDate && (actor1 || actor2) && avgTone) {
      output.write(`${sqlDate},${actor1},${actor2},${avgTone},${goldstein},${eventCode},${eventRootCode},${numArticles}\n`);
    }
  }

  output.end();
  console.log(`✅ Done. Saved enhanced data to "${OUTPUT_CSV}"`);
}

// MAIN
(async () => {
  try {
    const fetch = (await import('node-fetch')).default;
    console.log('🔍 Fetching latest GDELT export URL...');
    const url = await getLatestExportUrl(fetch);
    await downloadAndFilterGdelt(url, fetch);
  } catch (err) {
    console.error('❌ Error:', err.message);
  }
})();
