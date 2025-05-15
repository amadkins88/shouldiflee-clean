process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'; // ⚠️ WARNING: disables SSL checks!

import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import unzipper from 'unzipper';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import readline from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const updateUrl = 'https://data.gdeltproject.org/gdeltv2/lastupdate.txt';
const res = await fetch(updateUrl);
const text = await res.text();

console.log('🧾 lastupdate.txt contents:\n', text);

// 1. Find latest export CSV zip URL
const line = text.trim().split('\n')[0];
const parts = line.split(' ');
const fullUrl = parts.find(p => p.includes('.export.CSV.zip'));

if (!fullUrl) {
  throw new Error('❌ Could not find a valid export CSV zip in lastupdate.txt');
}

console.log(`🔍 Fetching latest file: ${fullUrl}`);

// 2. Download ZIP
const zipRes = await fetch(fullUrl);
if (!zipRes.ok) {
  throw new Error(`Failed to fetch ${fullUrl}: ${zipRes.statusText}`);
}
const zipBuffer = Buffer.from(await zipRes.arrayBuffer());

// 3. Prepare output file and unzip stream
const outputPath = path.join(__dirname, '..', 'gdelt-mirror.csv');
const writeStream = fs.createWriteStream(outputPath);
const zipStream = unzipper.Parse();
let wroteHeader = false;

const HEADER_ROW = `GLOBALEVENTID,SQLDATE,MonthYear,Year,FractionDate,Actor1Code,Actor1Name,Actor1CountryCode,Actor1KnownGroupCode,Actor1EthnicCode,Actor1Religion1Code,Actor1Religion2Code,Actor1Type1Code,Actor1Type2Code,Actor1Type3Code,Actor2Code,Actor2Name,Actor2CountryCode,Actor2KnownGroupCode,Actor2EthnicCode,Actor2Religion1Code,Actor2Religion2Code,Actor2Type1Code,Actor2Type2Code,Actor2Type3Code,IsRootEvent,EventCode,EventBaseCode,EventRootCode,QuadClass,GoldsteinScale,NumMentions,NumSources,NumArticles,AvgTone,Actor1Geo_Type,Actor1Geo_FullName,Actor1Geo_CountryCode,Actor1Geo_ADM1Code,Actor1Geo_ADM2Code,Actor1Geo_Lat,Actor1Geo_Long,Actor1Geo_FeatureID,Actor2Geo_Type,Actor2Geo_FullName,Actor2Geo_CountryCode,Actor2Geo_ADM1Code,Actor2Geo_ADM2Code,Actor2Geo_Lat,Actor2Geo_Long,Actor2Geo_FeatureID,ActionGeo_Type,ActionGeo_FullName,ActionGeo_CountryCode,ActionGeo_ADM1Code,ActionGeo_ADM2Code,ActionGeo_Lat,ActionGeo_Long,ActionGeo_FeatureID,DATEADDED,SOURCEURL`;

zipStream.on('entry', async entry => {
  console.log(`📁 Found: ${entry.path}`);

  const lower = entry.path.toLowerCase();
  if (!lower.endsWith('.csv')) {
    console.log(`⏭️ Skipping non-CSV: ${entry.path}`);
    entry.autodrain();
    return;
  }

  // Write headers once
  if (!wroteHeader) {
    writeStream.write(HEADER_ROW + '\n');
    wroteHeader = true;
  }

  // Stream each line to the output
  const rl = readline.createInterface({ input: entry, crlfDelay: Infinity });
  for await (const line of rl) {
    writeStream.write(line + '\n');
  }
});

zipStream.on('close', () => {
  console.log(`✅ Finished writing to ${outputPath}`);
});

zipStream.on('error', err => {
  console.error('❌ Error extracting ZIP:', err);
});

zipStream.end(zipBuffer);
