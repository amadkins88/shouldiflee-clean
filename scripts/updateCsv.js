// scripts/updateCsv.js
const fetch = require('node-fetch');
const fs = require('fs-extra');
const path = require('path');

const today = new Date();
const yyyymmdd = today.toISOString().slice(0, 10).replace(/-/g, '');
const GDELT_URL = `http://data.gdeltproject.org/gdeltv2/${yyyymmdd}*.export.CSV.zip`;

async function updateGdeltCsv() {
  try {
    const knownSampleUrl = 'http://data.gdeltproject.org/gdeltv2/lastupdate.txt';

    console.log('Grabbing latest update filename...');
    const res = await fetch(knownSampleUrl);
    const text = await res.text();
    const latestCsvFilename = text.trim().split(' ')[0];
    const csvUrl = `http://data.gdeltproject.org/gdeltv2/${latestCsvFilename}`;

    console.log(`Downloading: ${csvUrl}`);
    const csvRes = await fetch(csvUrl);
    const csvBuffer = await csvRes.buffer();

    const outputPath = path.join(__dirname, '..', 'gdelt-mirror.csv');
    await fs.writeFile(outputPath, csvBuffer);

    console.log(`✅ CSV saved to ${outputPath}`);
  } catch (err) {
    console.error('Failed to update GDELT CSV:', err);
  }
}

updateGdeltCsv();
