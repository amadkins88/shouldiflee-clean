const express = require('express');
const fs = require('fs');
const csv = require('csv-parser');
const cors = require('cors');

const app = express();
const PORT = 3000;

app.use(cors());

// Country weights (add or adjust as needed)
const violentEventCodes = new Set(['19', '20']); // 19 = fight, 20 = use of force

function calculateFleeScore(entry) {
  const avgTone = parseFloat(entry.AvgTone) || 0;
  const goldstein = parseFloat(entry.GoldsteinScale) || 0;
  const eventCode = (entry.EventRootCode || '').trim();
  const articleCount = parseInt(entry.NumArticles || entry.ArticleCount || '0');

  // Main weighted score formula
  let score = 0;

  // Tone is the strongest signal
  score += avgTone * 1.5;

  // Goldstein scale provides context (e.g., -10 = war, +10 = peace deal)
  score += goldstein * 0.7;

  // Event type – amplify score for violent conflict codes
  if (violentEventCodes.has(eventCode)) {
    score -= 1.5;
  }

  // Article count adds noise weight (but capped)
  if (articleCount > 0) {
    const cappedCount = Math.min(articleCount, 50); // cap influence at 50
    score -= cappedCount * 0.05;
  }

  return score;
}

function determineFleeStatus(score) {
  if (score <= -5) return 'YES';
  if (score <= -2.5) return 'MAYBE';
  return 'NO';
}

app.get('/api/flee-score', (req, res) => {
  const country = req.query.country;
  if (!country) {
    return res.status(400).json({ error: 'Country query parameter is required' });
  }

  const filePath = './gdelt-mirror.csv';

  const countryEntries = [];

  fs.createReadStream(filePath)
    .pipe(csv())
    .on('data', (row) => {
      if ((row.ActionGeo_CountryCode || '').toLowerCase() === country.toLowerCase()) {
        countryEntries.push(row);
      }
    })
    .on('end', () => {
      if (countryEntries.length === 0) {
        return res.status(404).json({ error: 'No entries found for specified country' });
      }

      // Aggregate and calculate weighted score
      const totalScore = countryEntries.reduce((sum, entry) => sum + calculateFleeScore(entry), 0);
      const avgScore = totalScore / countryEntries.length;
      const fleeStatus = determineFleeStatus(avgScore);

      res.json({
        country,
        fleeStatus,
        averageWeightedScore: avgScore.toFixed(2),
        eventCount: countryEntries.length
      });
    });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
