process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'; // ⚠️ DEV ONLY

import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import unzipper from 'unzipper';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import readline from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 1. Get latest file URL
const updateUrl = 'https://data.gdeltproject.org/gdeltv2/lastupdate.txt';
const res = await fetch(updateUrl);
const text = await res.text();
console.log('🧾 lastupdate.txt contents:\n', text);

const line = text.trim().split('\n')[0];
const parts = line.split(' ');
const fullUrl = parts.find(p => p.includes('.export.CSV.zip'));

if (!fullUrl) {
  throw new Error('❌ Could not find a .export.CSV.zip URL');
}

console.log(`🔍 Fetching latest file: ${fullUrl}`);
const zipRes = await fetch(fullUrl);
if (!zipRes.ok) {
  throw new Error(`Failed to fetch ${fullUrl}: ${zipRes.statusText}`);
}
const zipBuffer = Buffer.from(await zipRes.arrayBuffer());

// 2. Extract & combine all .csv files into gdelt-mirror.csv
const outputPath = path.join(__dirname, '..', 'gdelt-mirror.csv');
const writeStream = fs.createWriteStream(outputPath);
let wroteHeader = false;

const zipStream = unzipper.Parse();

zipStream.on('entry', async entry => {
  if (!entry.path.endsWith('.csv')) {
    entry.autodrain();
    return;
  }

  console.log(`📄 Extracting: ${entry.path}`);

  const rl = readline.createInterface({
    input: entry,
    crlfDelay: Infinity
  });

  let isFirstLine = true;

  for await (const line of rl) {
    if (isFirstLine) {
      if (!wroteHeader) {
        writeStream.write(line + '\n');
        wroteHeader = true;
      }
    } else {
      writeStream.write(line + '\n');
    }
    isFirstLine = false;
  }
});

zipStream.on('close', () => {
  writeStream.end();
  console.log(`✅ Combined CSV saved to ${outputPath}`);
});

zipStream.on('error', err => {
  console.error('❌ ZIP extraction error:', err);
});

zipStream.end(zipBuffer);
