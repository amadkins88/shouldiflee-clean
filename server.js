const express = require('express');
const axios = require('axios');
const csv = require('csv-parser');
const dayjs = require('dayjs');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS for the frontend
app.use(cors({
  origin: 'https://shouldiflee.com'
}));

const CSV_URL = 'https://raw.githubusercontent.com/amadkins88/shouldiflee-clean/main/gdelt-mirror.csv';

app.get('/api/flee-score', async (req, res) => {
  const country = req.query.country;

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
        if (row.Actor1CountryCode && row.AvgTone && row.SQLDATE) {
          const date = dayjs(row.SQLDATE, 'YYYYMMDD');
          const tone = parseFloat(row.AvgTone);

          if (
            date.isAfter(sevenDaysAgo) &&
            (
              row.Actor1CountryCode.toLowerCase() === country.toLowerCase() ||
              row.Actor2CountryCode?.toLowerCase() === country.toLowerCase()
            )
          ) {
            events.push({ date, tone });
          }
        }
      })
      .on('end', () => {
        if (events.length === 0) {
          return res.json({
            score: 0,
            topReason: `No significant events found in ${country} over the last 7 days.`,
            eventsChecked: 0,
            averageTone: 0,
            rawToneSample: []
          });
        }

        const tones = events.map(e => e.tone);
        const avgTone = tones.reduce((a, b) => a + b, 0) / tones.length;

        // Revised scoring: stronger tone weight, minimal event influence
        let score = 50; // Neutral midpoint
        score += avgTone < 0 ? Math.min(50, Math.abs(avgTone) * 8) : -Math.min(30, avgTone * 10);
        score += Math.min(10, events.length / 50); // Capped event bonus

        score = Math.max(0, Math.min(100, Math.round(score)));

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

app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
