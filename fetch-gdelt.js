const fs = require('fs');
const axios = require('axios');
const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const readline = require('readline');

dayjs.extend(utc);

const GDELT_BASE = 'http://data.gdeltproject.org/gdeltv2/';
const OUTPUT_CSV = 'gdelt-mirror.csv';
const TARGET_COUNTRIES = ['Ukraine', 'United States', 'Sudan', 'Canada'];

function generateRecentFileUrls(hoursBack = 6) {
  const urls = [];
  const now = dayjs().utc().startOf('minute');
  const rounded = now.subtract(now.minute() % 15, 'minute');

  for (let i = 0; i < hoursBack * 4; i++) {
    const timestamp = rounded.subtract(i * 15, 'minute').format('YYYYMMDDHHmm00');
    urls.push(`${GDELT_BASE}${timestamp}.export.CSV`);
  }
  return urls;
}


async function tryDownloadCsv(url) {
  try {
    console.log(`Trying: ${url}`);
    const res = await axios.get(url, { responseType: 'stream' });
    return res.data;
  } catch (err) {
    return null;
  }
}

async function saveFilteredGdeltData() {
  const urls = generateRecentFileUrls();
  for (const url of urls) {
    const stream = await tryDownloadCsv(url);
    if (!stream) continue;

    const rl = readline.createInterface({ input: stream });
    const outStream = fs.createWriteStream(OUTPUT_CSV);
    let matchedLines = 0;

    for await (const line of rl) {
      for (const country of TARGET_COUNTRIES) {
        if (line.includes(country)) {
          outStream.write(line + '\n');
          matchedLines++;
          break;
        }
      }
    }

    rl.close();
    outStream.end();

    if (matchedLines > 0) {
      console.log(`✅ Saved ${matchedLines} matching events to ${OUTPUT_CSV}`);
      return;
    } else {
      console.log(`No relevant data in ${url}`);
      fs.unlinkSync(OUTPUT_CSV); // delete empty file
    }
  }

  console.log('❌ No usable GDELT data found in recent intervals.');
}

saveFilteredGdeltData();
