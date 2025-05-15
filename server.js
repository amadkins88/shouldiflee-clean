const express = require('express');
const fs = require('fs');
const Papa = require('papaparse');
const app = express();
const PORT = process.env.PORT || 3000;
const CSV_FILE = 'gdelt-mirror.csv';

app.use(express.static('public'));

app.get('/api/data', (req, res) => {
  fs.readFile(CSV_FILE, 'utf8', (err, csvData) => {
    if (err) {
      console.error('Error reading CSV file:', err);
      return res.status(500).send('Server error');
    }

    const parsed = Papa.parse(csvData, { header: true });
    const rows = parsed.data;

    const result = {};

    for (const row of rows) {
      const country = row.ActionGeo_CountryCode;
      const tone = parseFloat(row.AvgTone);
      const goldstein = parseFloat(row.GoldsteinScale);
      const articles = parseInt(row.NumArticles);
      const rootCode = row.EventRootCode;

      if (!country || isNaN(tone) || isNaN(goldstein) || isNaN(articles)) continue;

      if (!result[country]) {
        result[country] = {
          tones: [],
          goldsteins: [],
          articleCount: 0,
          violenceEventCount: 0,
        };
      }

      result[country].tones.push(tone);
      result[country].goldsteins.push(goldstein);
      result[country].articleCount += articles;

      if (['14', '18', '19'].includes(rootCode)) {
        result[country].violenceEventCount += 1;
      }
    }

    const output = {};

    for (const country in result) {
      const data = result[country];
      const avgTone = data.tones.reduce((a, b) => a + b, 0) / data.tones.length;
      const avgGoldstein = data.goldsteins.reduce((a, b) => a + b, 0) / data.goldsteins.length;
      const violence = data.violenceEventCount;
      const articles = data.articleCount;

      const fleeScore = (-2 * avgTone) + (0.5 * violence) + (-1 * avgGoldstein) + Math.log(articles + 1);

      let fleeLabel = 'NO';
      if (fleeScore > 10) fleeLabel = 'YES';
      else if (fleeScore > 5) fleeLabel = 'MAYBE';

      output[country] = {
        country,
        avgTone: avgTone.toFixed(2),
        avgGoldstein: avgGoldstein.toFixed(2),
        articleCount: articles,
        violenceEventCount: violence,
        fleeScore: fleeScore.toFixed(2),
        fleeLabel,
      };
    }

    res.json(output);
  });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
