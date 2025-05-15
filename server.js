// server.js
const express = require('express');
const fs      = require('fs');
const path    = require('path');
const cors    = require('cors');

const app  = express();
const port = process.env.PORT || 3000;
const CSV_PATH = path.join(__dirname, 'gdelt-mirror.csv');

// ——————————————————————————————————————————————————————————
// 1) Dynamic CORS: allow any origin (for dev + prod)
// ——————————————————————————————————————————————————————————
app.use(cors({
  origin: (origin, callback) => {
    // allow requests from any domain
    callback(null, true);
  },
  credentials: true
}));

// ——————————————————————————————————————————————————————————
// 2) Serve your frontend from /public
// ——————————————————————————————————————————————————————————
app.use(express.static(path.join(__dirname, 'public')));

// ——————————————————————————————————————————————————————————
// 3a) /api/rawcsv → just return the CSV as text
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
// 3b) /api/data → parse CSV into JSON with simple split()
//               numeric fields default to 0 if missing
// ——————————————————————————————————————————————————————————
app.get('/api/data', (req, res) => {
  fs.readFile(CSV_PATH, 'utf8', (err, csvText) => {
    if (err) {
      console.error('Error reading CSV:', err);
      return res.status(500).json({ error: 'Error reading CSV file' });
    }

    const lines = csvText.trim().split('\n');
    if (lines.length < 2) {
      return res.json([]);
    }

    const headers = lines.shift().split(',');
    const data = lines.map(line => {
      const cols = line.split(',');
      const obj = {};

      headers.forEach((h, i) => {
        let val = cols[i] === undefined ? '' : cols[i].trim();

        // fallback for numeric fields:
        if (['AvgTone','GoldsteinScale','NumArticles'].includes(h)) {
          // parseFloat or 0 if empty / invalid
          const n = parseFloat(val);
          val = Number.isFinite(n) ? n : 0;
        }

        obj[h] = val;
      });

      return obj;
    });

    res.json(data);
  });
});

// ——————————————————————————————————————————————————————————
// 4) Catch-all to serve index.html for SPA routing
// ——————————————————————————————————————————————————————————
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ——————————————————————————————————————————————————————————
// 5) Start
// ——————————————————————————————————————————————————————————
app.listen(port, () => {
  console.log(`🚀  Server running on http://localhost:${port}`);
});
