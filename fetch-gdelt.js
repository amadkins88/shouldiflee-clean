const axios = require('axios');
const fs = require('fs');
const csv = require('csv-parser');
const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
dayjs.extend(utc);

const OUTPUT_CSV = 'gdelt-mirror.csv';
const COUNTRIES = ['United States', 'Ukraine', 'Sudan', 'Canada']; // Update as needed

// Get 8 most recent intervals (every 15 minutes)
function generateRecentFileUrls(hoursBack = 2) {
  const urls = [];
  const now = dayjs().utc().startOf('minute');
  const rounded = now.subtract(now.minute() % 15, 'minute');

  for (let i = 0; i < (hoursBack * 4); i++) {
    const timestamp = rounded.subtract(i * 15, 'minute').format('YYYYMMDDHHmm00');
    urls.push(`http://data.gdeltproject.org/gdeltv2/${timestamp}.export.CSV`);
  }
  return urls;
}


// Download and filter a GDELT CSV file
async function downloadAndFilterCSV(url) {
  const results = [];

  try {
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
  } catch (err) {
    return []; // Skip missing file
  }
}

// Save filtered data
function saveToCSV(events) {
  const header = 'date,country,tone\n';
  const rows = events.map(e => `${e.date},${e.country},${e.tone}`);
  fs.writeFileSync(OUTPUT_CSV, header + rows.join('\n'));
}

// Main
(async () => {
  try {
    const urls = generateRecentFileUrls(4); // Try last 4 hours
    const allEvents = [];

    for (const url of urls) {
      console.log(`Trying: ${url}`);
      const events = await downloadAndFilterCSV(url);
      if (events.length > 0) {
        console.log(`✅ Found ${events.length} events in ${url}`);
        allEvents.push(...events);
      }
    }

    if (allEvents.length === 0) {
      console.log('No usable GDELT data found in recent intervals.');
    } else {
      saveToCSV(allEvents);
      console.log(`✅ Saved ${allEvents.length} events to ${OUTPUT_CSV}`);
    }
  } catch (err) {
    console.error('❌ Error:', err.message);
  }
})();
