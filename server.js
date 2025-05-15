// server.js
const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 3000;
const CSV_PATH = path.join(__dirname, 'gdelt-mirror.csv');

// ——————————————————————————————————————————————————————————
// 1) CORS
// ——————————————————————————————————————————————————————————
app.use(cors({
  origin: (origin, callback) => callback(null, true),
  credentials: true
}));

// ——————————————————————————————————————————————————————————
// 2) Serve frontend
// ——————————————————————————————————————————————————————————
app.use(express.static(path.join(__dirname, 'public')));

// ——————————————————————————————————————————————————————————
// 3a) /api/rawcsv
// ——————————————————————————————————————————————————————————
app.get('/api/rawcsv', (req, res) => {
  fs.readFile(CSV_PATH, 'utf8', (err, csvText) => {
    if (err) {
      console.error('Error reading CSV:', err);
      return res.status(500).send('Error reading CSV file');
    }
    res.type('text/plain').send(csvText);
  });
});

// ——————————————————————————————————————————————————————————
// 3b) /api/data → CSV to JSON
// ——————————————————————————————————————————————————————————
app.get('/api/data', (req, res) => {
  fs.readFile(CSV_PATH, 'utf8', (err, csvText) => {
    if (err) {
      console.error('Error reading CSV:', err);
      return res.status(500).json({ error: 'Error reading CSV file' });
    }

    const lines = csvText.trim().split('\n');
    const headers = lines.shift().split(',').map(h => h.trim());
    const data = lines.map(line => {
      const cols = line.split(',');
      const obj = {};

      headers.forEach((header, i) => {
        let val = cols[i]?.trim() || '';
        if (['AvgTone', 'GoldsteinScale', 'NumArticles'].includes(header)) {
          const n = parseFloat(val);
          val = Number.isFinite(n) ? n : 0;
        }
        obj[header] = val;
      });

      return obj;
    });

    res.json(data);
  });
});

// ——————————————————————————————————————————————————————————
// 3c) /api/flee-score?country=USA
// ——————————————————————————————————————————————————————————
app.get('/api/flee-score', (req, res) => {
  const requestedCountry = req.query.country?.toUpperCase();

  fs.readFile(CSV_PATH, 'utf8', (err, csvText) => {
    if (err) {
      console.error('Error reading CSV:', err);
      return res.status(500).json({ error: 'Could not read CSV' });
    }

    const lines = csvText.trim().split('\n');
    const headers = lines.shift().split(',').map(h => h.trim());
    const data = lines.map(line => {
      const cols = line.split(',');
      const row = {};
      headers.forEach((header, i) => {
        let val = cols[i]?.trim() || '';
        if (['AvgTone', 'GoldsteinScale', 'NumArticles'].includes(header)) {
          val = parseFloat(val);
          row[header] = Number.isFinite(val) ? val : 0;
        } else {
          row[header] = val;
        }
      });
      return row;
    });

    // 🔍 Use Actor1CountryCode as filter
    const filtered = data.filter(d => d.Actor1CountryCode === requestedCountry);

    if (filtered.length === 0) {
      console.warn(`No matching rows for country: ${requestedCountry}`);
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

// ——————————————————————————————————————————————————————————
// 4) Fallback route for SPA
// ——————————————————————————————————————————————————————————
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ——————————————————————————————————————————————————————————
// 5) Start the server
// ——————————————————————————————————————————————————————————
app.listen(port, () => {
  console.log(`🚀 Server running on http://localhost:${port}`);
});
