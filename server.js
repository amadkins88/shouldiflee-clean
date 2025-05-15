const express = require('express');
const axios = require('axios');
const csv = require('csv-parser');
const dayjs = require('dayjs');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS only for your frontend domain
app.use(cors({
  origin: 'https://shouldiflee.com'
}));

const CSV_URL = 'https://raw.githubusercontent.com/amadkins88/shouldiflee-clean/main/gdelt-mirror.csv';

// 🧠 Main flee score endpoint
app.get('/api/flee-score', async (req, res) => {
  const country = req.query.country?.toUpperCase();

  if (!country) {
    return res.status(400).json({ error: 'Missing country parameter' });
  }

  try {
    const response = await axios.get(CSV_URL, { responseType: 'stream' });

    const events = [];
    const today = dayjs();
    const sevenDaysAgo = today.subtract(7, 'day');

    response.data
      .pipe(csv())
      .on('data', (row) => {
        const date = dayjs(row.SQLDATE, 'YYYYMMDD');
        const tone = parseFloat(row.AvgTone);
        const actor1 = row.Actor1CountryCode?.toUpperCase();
        const actor2 = row.Actor2CountryCode?.toUpperCase();

        if (
          date.isValid() &&
          date.isAfter(sevenDaysAgo) &&
          (actor1 === country || actor2 === country) &&
          !isNaN(tone)
        ) {
          events.push({ date, tone });
        }
      })
      .on('end', () => {
        if (events.length === 0) {
          return res.json({
            score: 0,
            topReason: `No significant events found involving ${country} over the last 7 days.`,
            eventsChecked: 0,
            averageTone: 0,
            rawToneSample: []
          });
        }

        const tones = events.map(e => e.tone);
        const avgTone = tones.reduce((a, b) => a + b, 0) / tones.length;
        const tonePenalty = Math.max(0, (10 + avgTone) * 5); // more negative tone = more penalty
        let score = Math.min(100, events.length * 2 + tonePenalty);
        score = Math.max(0, Math.round(score - avgTone * 2)); // deduct if tone is improving

        res.json({
          score,
          topReason: `Based on ${events.length} events with an average tone of ${avgTone.toFixed(2)}.`,
          eventsChecked: events.length,
          averageTone: avgTone,
          rawToneSample: tones.slice(0, 5)
        });
      });

  } catch (err) {
    console.error('❌ Error fetching CSV:', err.message);
    res.status(500).json({ error: 'Internal server error fetching data.' });
  }
});

// 🌍 Optional: API to return all countries seen in the data
app.get('/api/countries', async (req, res) => {
  try {
    const response = await axios.get(CSV_URL, { responseType: 'stream' });

    const countries = new Set();

    response.data
      .pipe(csv())
      .on('data', (row) => {
        const actor1 = row.Actor1CountryCode?.toUpperCase();
        const actor2 = row.Actor2CountryCode?.toUpperCase();
        if (actor1) countries.add(actor1);
        if (actor2) countries.add(actor2);
      })
      .on('end', () => {
        res.json(Array.from(countries).sort());
      });

  } catch (err) {
    console.error('❌ Error fetching CSV for countries:', err.message);
    res.status(500).json({ error: 'Failed to fetch country list.' });
  }
});

// ✅ Server startup
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
