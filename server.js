const express = require('express');
const cors = require('cors');
const axios = require('axios');
const csv = require('csv-parser');
const { pipeline } = require('stream');
const { promisify } = require('util');
const dayjs = require('dayjs');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
  origin: 'https://shouldiflee.com'
}));

const asyncPipeline = promisify(pipeline);

const fetchGDELTData = async (country, days = 7) => {
  const today = dayjs();
  const results = [];
  const lowerCountry = country.toLowerCase();

  for (let i = 0; i < days; i++) {
    const dateStr = today.subtract(i, 'day').format('YYYYMMDD');
    const url = `http://data.gdeltproject.org/gdeltv2/${dateStr}.export.CSV`;

    try {
      const response = await axios({
        method: 'get',
        url,
        responseType: 'stream',
        timeout: 15000
      });

      await asyncPipeline(
        response.data,
        csv({ headers: false }),
        async function* (source) {
          for await (const row of source) {
            const actionGeoFullName = row[51]?.toLowerCase();
            const avgTone = parseFloat(row[34]);

            if (actionGeoFullName && actionGeoFullName.includes(lowerCountry) && !isNaN(avgTone)) {
              results.push(avgTone);
            }
          }
        }
      );
    } catch (err) {
      console.warn(`⚠️ Skipping ${url} due to fetch error or missing file.`);
    }
  }

  return results;
};

app.get('/api/flee-score', async (req, res) => {
  try {
    const country = req.query.country || 'United States';
    const tones = await fetchGDELTData(country, 7);
    const eventCount = tones.length;

    let averageTone = 0;
    if (eventCount > 0) {
      averageTone = tones.reduce((a, b) => a + b, 0) / eventCount;
    }

    const rawScore = eventCount * 2;

    let tonePenalty = 0;
    if (averageTone >= -2) tonePenalty = 60;
    else if (averageTone >= -4) tonePenalty = 40;
    else if (averageTone >= -6) tonePenalty = 20;

    const score = Math.max(0, Math.min(100, rawScore - tonePenalty));

    const reason = eventCount > 0
      ? `${eventCount} events in ${country} over the last 7 days with an average tone of ${averageTone.toFixed(2)}.`
      : `No significant events found in ${country} over the last 7 days.`;

    res.json({
      score,
      topReason: reason,
      eventsChecked: eventCount,
      averageTone,
      rawToneSample: tones.slice(0, 10)
    });

  } catch (error) {
    console.error('❌ Mirror-based fetch failed:', error);
    res.status(500).json({ error: 'Failed to fetch and parse GDELT data.' });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 CSV mirror version running on port ${PORT}`);
});
