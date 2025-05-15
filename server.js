const express = require('express');
const axios = require('axios');
const csv = require('csv-parser');
const dayjs = require('dayjs');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Allow CORS for frontend
app.use(cors({
  origin: 'https://shouldiflee.com'
}));

// Replace with your latest hosted CSV path
const CSV_URL = 'https://raw.githubusercontent.com/amadkins88/shouldiflee-clean/main/gdelt-mirror.csv';

const ROOT_EVENT_WEIGHTS = {
  "14": 1.5, // Protest
  "19": 2.0, // Armed Conflict
  "17": 1.2, // Coercion
  "13": 1.2, // Threaten
  "01": 0.5, // Make Public Statement (low risk)
  "03": 0.3  // Express Intent to Cooperate (very low)
};

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
        const date = dayjs(row.SQLDATE, 'YYYYMMDD');
        const countryMatch =
          row.Actor1CountryCode?.toLowerCase() === country.toLowerCase() ||
          row.Actor2CountryCode?.toLowerCase() === country.toLowerCase();

        if (
          date.isAfter(sevenDaysAgo) &&
          row.AvgTone && row.GoldsteinScale &&
          row.EventRootCode && row.NumArticles &&
          countryMatch
        ) {
          const tone = parseFloat(row.AvgTone);
          const goldstein = parseFloat(row.GoldsteinScale);
          const articles = parseInt(row.NumArticles) || 1;
          const weight = ROOT_EVENT_WEIGHTS[row.EventRootCode] || 1;

          events.push({
            tone,
            goldstein,
            weight,
            articles,
            effectiveTone: tone * weight * goldstein * Math.log1p(articles)
          });
        }
      })
      .on('end', () => {
        if (events.length === 0) {
          return res.json({
            score: 0,
            topReason: `No significant events found for this country in the last 7 days.`,
            eventsChecked: 0,
            averageTone: 0,
            rawToneSample: []
          });
        }

        const totalWeight = events.reduce((sum, e) => sum + Math.abs(e.effectiveTone), 0);
        const totalTone = events.reduce((sum, e) => sum + e.effectiveTone, 0);
        const averageTone = totalTone / totalWeight;

        // Pure tone-based scoring logic
        let fleeAnswer = 'NO';
        if (averageTone <= -5.0) fleeAnswer = 'YES';
        else if (averageTone <= -2.5) fleeAnswer = 'MAYBE';

        const score = fleeAnswer === 'YES' ? 100 : fleeAnswer === 'MAYBE' ? 60 : 30;

        res.json({
          score,
          topReason: `Based on ${events.length} events with an average weighted tone of ${averageTone.toFixed(2)}.`,
          eventsChecked: events.length,
          averageTone,
          rawToneSample: events.slice(0, 5).map(e => e.tone.toFixed(2)),
        });
      });

  } catch (err) {
    console.error('❌ Error fetching or parsing CSV:', err.message);
    res.status(500).json({ error: 'Internal server error fetching data.' });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
