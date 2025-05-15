const express = require('express');
const fetch = require('node-fetch');
const csv = require('csv-parser');
const app = express();
const PORT = process.env.PORT || 3000;

const CSV_URL = 'https://raw.githubusercontent.com/amadkins88/shouldiflee-clean/main/gdelt-mirror.csv';

app.use(express.static('public'));

function fetchAndAnalyze(country) {
  return new Promise((resolve, reject) => {
    const tones = [];
    fetch(CSV_URL)
      .then(res => res.body.pipe(csv()))
      .then(stream => {
        stream.on('data', (row) => {
          if (row.country?.toLowerCase() === country.toLowerCase()) {
            const tone = parseFloat(row.tone);
            if (!isNaN(tone)) tones.push(tone);
          }
        });
        stream.on('end', () => {
          if (tones.length === 0) {
            return resolve({
              score: 0,
              averageTone: null,
              rawToneSample: [],
              eventsChecked: 0,
              topReason: 'No recent events found for this country.'
            });
          }

          const averageTone = tones.reduce((a, b) => a + b, 0) / tones.length;
          const tonePenalty = Math.max(0, (1 - (averageTone + 10) / 10)); // avgTone -10 → full penalty, 0 → no penalty
          const volumeBonus = Math.min(tones.length / 200, 1); // if 200+ events, full volume

          const score = Math.round(100 * tonePenalty * volumeBonus);

          resolve({
            score,
            averageTone,
            rawToneSample: tones.slice(0, 5),
            eventsChecked: tones.length,
            topReason: `Analyzed ${tones.length} events. Avg tone: ${averageTone.toFixed(2)}.`
          });
        });
      })
      .catch(err => reject(err));
  });
}

app.get('/api/flee-score', async (req, res) => {
  const country = req.query.country;
  if (!country) return res.status(400).json({ error: 'Country is required' });

  try {
    const result = await fetchAndAnalyze(country);
    res.json(result);
  } catch (err) {
    console.error('CSV mirror error:', err);
    res.status(500).json({ error: 'Failed to analyze CSV data' });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Mirror API running on port ${PORT}`);
});
