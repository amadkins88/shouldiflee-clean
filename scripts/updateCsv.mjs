process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'; // ⚠️ WARNING: disables SSL checks!

import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import unzipper from 'unzipper';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 1. GDELT .export.CSV headers
const CSV_HEADERS = `GLOBALEVENTID,SQLDATE,MonthYear,Year,FractionDate,Actor1Code,Actor1Name,Actor1CountryCode,Actor2Code,Actor2Name,Actor2CountryCode,IsRootEvent,EventCode,EventBaseCode,EventRootCode,QuadClass,GoldsteinScale,NumMentions,NumSources,NumArticles,AvgTone,Actor1Geo_Type,Actor1Geo_FullName,Actor1Geo_CountryCode,Actor1Geo_ADM1Code,Actor1Geo_Lat,Actor1Geo_Long,Actor1Geo_FeatureID,Actor2Geo_Type,Actor2Geo_FullName,Actor2Geo_CountryCode,Actor2Geo_ADM1Code,Actor2Geo_Lat,Actor2Geo_Long,Actor2Geo_FeatureID,ActionGeo_Type,ActionGeo_FullName,ActionGeo_CountryCode,ActionGeo_ADM1Code,ActionGeo_Lat,ActionGeo_Long,ActionGeo_FeatureID,DATEADDED,SOURCEURL\n`;

// 2. Fetch the latest update file
const updateUrl = 'https://data.gdeltproject.org/gdeltv2/lastupdate.txt';
const res = await fetch(updateUrl);
const text = await res.text();
console.log('🧾 lastupdate.txt contents:\n', text);

const line = text.trim().split('\n')[0];
const parts = line.split(' ');
const fullUrl = parts.find(p => p.startsWith('http'));

if (!fullUrl) {
  throw new Error('❌ Could not find a valid URL in lastupdate.txt');
}

console.log(`🔍 Fetching latest file: ${fullUrl}`);

// 3. Download the ZIP file
const zipRes = await fetch(fullUrl);
if (!zipRes.ok) {
  throw new Error(`Failed to fetch ${fullUrl}: ${zipRes.statusText}`);
}
const zipBuffer = Buffer.from(await zipRes.arrayBuffer());

// 4. Extract and prepend headers
const outputPath = path.join(__dirname, '..', 'gdelt-mirror.csv');
const tempChunks = [];

const zipStream = unzipper.ParseOne();

zipStream.on('entry', entry => {
  entry.on('data', chunk => tempChunks.push(chunk));
  entry.on('end', () => {
    const fullCsv = CSV_HEADERS + Buffer.concat(tempChunks).toString('utf8');
    fs.writeFileSync(outputPath, fullCsv);
    console.log(`✅ Saved CSV with headers to ${outputPath}`);
  });
});

zipStream.on('error', err => {
  console.error('❌ Error extracting ZIP:', err);
});

zipStream.end(zipBuffer);
