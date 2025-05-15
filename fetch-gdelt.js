const fs = require('fs');
const axios = require('axios');
const unzipper = require('unzipper');
const csv = require('csv-parser');

const GDELT_LAST_UPDATE_URL = 'http://data.gdeltproject.org/gdeltv2/lastupdate.txt';
const OUTPUT_FILE = 'gdelt-mirror.csv';
const COUNTRY_FILTER = ['Ukraine', 'United States', 'Sudan', 'Canada']; // Customize your countries here

async function getLatestFileUrl() {
  const res = await axios.get(GDELT_LAST_UPDATE_URL);
  const lines = res.data.trim().split('\n');
  return lines[1]; // Second line is the full file URL
}

async function downloadAndFilterCSV(csvUrl) {
  const response = await axios.get(csvUrl, { responseType: 'stream' });

  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(OUTPUT_FILE);
    output.write('GLOBALEVENTID,SQLDATE,Actor1CountryCode,Actor2CountryCode,AvgTone\n');

    response.data
      .pipe(csv({ headers: false }))
      .on('data', (row) => {
        const actor1Country = row[7];
        const actor2Country = row[17];
        const avgTone = row[34];
        const sqlDate = row[1];

        if (
          COUNTRY_FILTER.includes(actor1Country) ||
          COUNTRY_FILTER.includes(actor2Country)
        ) {
          const line = `${row[0]},${sqlDate},${actor1Country},${actor2Country},${avgTone}\n`;
          output.write(line);
        }
      })
      .on('end', () => {
        output.end();
        resolve();
      })
      .on('error', reject);
  });
}

(async () => {
  try {
    console.log('🔍 Fetching latest GDELT export URL...');
    const latestCsvUrl = await getLatestFileUrl();
    console.log(`📥 Downloading: ${latestCsvUrl}`);
    await downloadAndFilterCSV(latestCsvUrl);
    console.log(`✅ Done. Saved filtered data to "${OUTPUT_FILE}"`);
  } catch (err) {
    console.error('❌ Error fetching or processing GDELT data:', err.message || err);
  }
})();
