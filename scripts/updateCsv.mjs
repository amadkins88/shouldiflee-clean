process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'; // ⚠️ WARNING: disables SSL checks!

import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import unzipper from 'unzipper';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 1. Get the latest GDELT update file
const updateUrl = 'https://data.gdeltproject.org/gdeltv2/lastupdate.txt';
const res = await fetch(updateUrl);
const text = await res.text();
const latestLine = text.trim().split('\n')[0];
const latestZip = latestLine.split(' ')[0]; // Already includes .export.CSV.zip
const zipUrl = `https://data.gdeltproject.org/gdeltv2/${latestZip}`;




console.log(`🔍 Fetching latest file: ${zipUrl}`);

// 2. Download the ZIP file
const zipRes = await fetch(zipUrl);
if (!zipRes.ok) {
  throw new Error(`Failed to fetch ${zipUrl}: ${zipRes.statusText}`);
}
const zipBuffer = Buffer.from(await zipRes.arrayBuffer());

// 3. Extract CSV from ZIP and save to gdelt-mirror.csv
const outputPath = path.join(__dirname, '..', 'gdelt-mirror.csv');

const zipStream = unzipper.ParseOne();
zipStream.on('entry', entry => {
  entry.pipe(fs.createWriteStream(outputPath))
    .on('finish', () => console.log(`✅ Saved CSV to ${outputPath}`));
});

zipStream.on('error', err => {
  console.error('❌ Error extracting ZIP:', err);
});

zipStream.end(zipBuffer);
