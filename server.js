const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 3000;
const CSV_PATH = path.join(__dirname, 'gdelt-mirror.csv');

app.use(cors({ origin: (origin, callback) => callback(null, true), credentials: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/flee-score', (req, res) => {
  const requestedCountry = req.query.country?.trim().toUpperCase();

  fs.readFile(CSV_PATH, 'utf8', (err, tsvText) => {
    if (err) {
      console.error('Error reading CSV:', err);
      return res.status(500).json({ error: 'Could not read CSV' });
    }

    const lines = tsvText.trim().split('\n');
    const headers = lines.shift().split('\t');
    const data = lines.map(line => {
      const cols = line.split('\t');
      const row = {};
      headers.forEach((h, i) => {
        let val = cols[i]?.trim() || '';
        if (['AvgTone', 'GoldsteinScale', 'NumArticles'].includes(h)) {
          val = parseFloat(val);
          row[h] = Number.isFinite(val) ? val : 0;
        } else {
          row[h] = val;
        }
      });
      return row;
    });

    const filtered = data.filter(d => d.Actor1CountryCode === requestedCountry);
    if (filtered.length === 0) {
      return res.status(404).json({ error: 'No data for that country.' });
    }

    const tones = filtered.map(d => d.AvgTone);
    const averageTone = tones.reduce((a, b) => a + b, 0) / tones.length;

    const flee =
      averageTone <= -5.0 ? 'YES' :
      averageTone <= -2.5 ? 'MAYBE' :
      'NO';

    const score =
      averageTone <= -5.0 ? 90 :
      averageTone <= -4.0 ? 75 :
      averageTone <= -2.5 ? 60 :
      averageTone <= -1.5 ? 40 :
      10;

    res.json({
      score,
      flee,
      averageTone,
      eventsChecked: filtered.length,
      rawToneSample: tones.slice(0, 5),
      topReason: `Average tone is ${averageTone.toFixed(2)} based on ${filtered.length} events.`
    });
  });
});

app.listen(port, () => {
  console.log(`🚀 Server running on http://localhost:${port}`);
});
