const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { BigQuery } = require('@google-cloud/bigquery');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Write GCP key from environment into a real file
const keyPath = path.join(__dirname, 'gdelt-key.json');

if (!fs.existsSync(keyPath)) {
  try {
    const keyBuffer = Buffer.from(process.env.GDELT_KEY_B64, 'base64');
    fs.writeFileSync(keyPath, keyBuffer);
    console.log('✔️ GDELT key written to disk');
  } catch (err) {
    console.error('❌ Failed to decode GDELT_KEY_B64:', err);
  }
}

const bigquery = new BigQuery({
  keyFilename: keyPath,
});

app.use(cors());

app.get('/api/flee-score', async (req, res) => {
  try {
    const country = req.query.country || 'United States';
    const searchTerm = country.toLowerCase();

    const query = `
      SELECT AvgTone
      FROM \`gdelt-bq.gdeltv2.events\`
      WHERE SQLDATE >= CAST(FORMAT_DATE('%Y%m%d', DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)) AS INT64)
        AND LOWER(ActionGeo_FullName) LIKE '%${searchTerm}%'
    `;

    const [rows] = await bigquery.query({ query });
    const eventCount = rows.length;

    const avgToneSample = rows.map(r => parseFloat(r.AvgTone)).filter(n => !isNaN(n));
    const negativeEvents = avgToneSample.filter(n => n < 0);
    const avgTone = negativeEvents.length
      ? negativeEvents.reduce((sum, n) => sum + n, 0) / negativeEvents.length
      : 0;

    const score = Math.min(Math.round(eventCount * 2 + (avgTone < 0 ? -avgTone * 15 : 0)), 100);
    const reason = eventCount > 0
      ? `${eventCount} events reported in ${country} with an average tone of ${avgTone.toFixed(2)}.`
      : `No significant events reported in ${country} over the last 30 days.`;

    res.json({
      score,
      topReason: reason,
      eventsChecked: eventCount,
      negativeEvents: negativeEvents.length,
      averageTone: avgTone,
      rawToneSample: avgToneSample.slice(0, 10)
    });
  } catch (error) {
    console.error("GDELT query error:", error);
    res.status(500).json({ error: "Failed to query GDELT data." });
  }
});

app.listen(PORT, () => {
  console.log(`🌍 Server running on port ${PORT}`);
});
