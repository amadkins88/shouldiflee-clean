const axios = require('axios');
const fs = require('fs');
const csv = require('csv-parser');
const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
dayjs.extend(utc);

const GDELT_INDEX = 'http://data.gdeltproject.org/gdeltv2/lastupdate.txt';
const OUTPUT_CSV = 'gdelt-mirror.csv';
const COUNTRIES = ['United States', 'Ukraine', 'Sudan', 'Canada']; // Adjust as needed

const today = dayjs().utc();
const fallback = today.subtract(1, 'day');
const dateString = today.format('YYYYMMDD');
const fallbackString = fallback.format('YYYYMMDD');

// Get latest file list (today or fallback to yesterday)
async function fetchGdeltFileList() {
  const res = await axios.get(GDELT_INDEX);
  const lines = res.data.split('\n');

  const todayFiles = lines.filter(line => line.includes(dateString) && line.endsWith('.export.csv')).map(line => line.trim());
  if (todayFiles.length > 0) return todayFiles;

  const fallbackFiles = lines.filter(line => line.includes(fallbackString) && line.endsWith('.export.csv')).map(line => line.trim());
  return fallbackFiles;
}

// Download and filter a single GDELT CSV file
async function downloadAndFilterCSV(url) {
  const results = [];

  const response = await axios.get(url, { responseType: 'stream' });

  return new Promise((resolve, reject) => {
    response.data
      .pipe(csv({ headers: false }))
      .on('data', (data) => {
        const country = data[51]; // Actor1CountryCode
        const tone = parseFloat(data[34]); // Tone
        const event = {
          date: data[1],
          country: data[51],
          tone: isNaN(tone) ? null : tone,
        };

        if (COUNTRIES.includes(country)) {
          results.push(event);
        }
      })
      .on('end', () => resolve(results))
      .on('error', reject);
  });
}

// Save filtered events to local CSV
function saveToCSV(events, outputFile) {
  const header = 'date,country,tone\n';
  const rows = events.map(e => `${e.date},${e.country},${e.tone}`);
  fs.writeFileSync(outputFile, header + rows.join('\n'));
}

// Main logic
(async () => {
  try {
    const files = await fetchGdeltFileList();

    if (!files.length) {
      console.log('No data files available yet for today or fallback.');
      return;
    }

    const urls = files.map(file => `http://data.gdeltproject.org/gdeltv2/${file}`);
    const allEvents = [];

    for (const url of urls.slice(0, 5)) { // limit to 5 files to avoid overload
      console.log(`Fetching ${url}...`);
      const events = await downloadAndFilterCSV(url);
      allEvents.push(...events);
    }

    saveToCSV(allEvents, OUTPUT_CSV);
    console.log(`✅ Saved ${allEvents.length} filtered events to ${OUTPUT_CSV}`);
  } catch (err) {
    console.error('❌ Failed:', err.message);
  }
})();
