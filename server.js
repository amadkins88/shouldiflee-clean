const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { BigQuery } = require('@google-cloud/bigquery');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Decode service account key from base64 and write it to a temp file
const keyPath = path.join(__dirname, 'gdelt-key.json');

if (!fs.existsSync(keyPath)) {
  const encodedKey = process.env.GDELT_KEY_B64;

  if (!encodedKey) {
    console.error('❌ GDELT_KEY_B64 is not set in your environment variables.');
    process.exit(1);
  }

  try {
    const keyBuffer = Buffer.from(encodedKey, 'base64');
    fs.writeFileSync(keyPath, keyBuffer);
    console.log('✔️ Service account key written to gdelt-key.json');
  } catch (err) {
    console.error('❌ Failed to decode or write GDELT_KEY_B64:', err);
    process.exit(1);
  }
}

const bigquery = new BigQuery({
  keyFilename: keyPath,
});

app.use(cors({
  origin: 'https://shouldiflee.com'
}));

app.get('/api/flee-score', async (req, res) => {
  try {
    const country = req.query.country || 'United States';
    const searchTerm = country.toLowerCase();

    const query = `
      SELECT AvgTone
      FROM \`gdelt-bq.gdeltv2.events\`
      WHERE SQLDATE >= CAST(FORMAT_DATE('%Y%m%d', DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY)) AS INT64)
        AND LOWER(ActionGeo_FullName) LIKE '%${searchTerm}%'
      LIMIT 1000
    `;

    const [rows] = await bigquery.query({ query });
    const eventCount = rows.length;

    const avgToneSample = rows.map(r => parseFloat(r.AvgTone)).filter(n => !isNaN(n));
    const avgTone = avgToneSample.length
      ? avgToneSample.reduce((sum, n) => sum + n, 0) / avgToneSample.length
      : 0;

    const negativityMultiplier = avgTone < 0 ? Math.pow(-avgTone, 1.5) * 4 : 0;
    const score = Math.min(Math.round(eventCount * negativityMultiplier), 100);

    const reason = eventCount > 0
      ? `${eventCount} events reported in ${country} over the last 7 days with an average tone of ${avgTone.toFixed(2)}.`
      : `No significant events reported in ${country} over the last 7 days.`;

    res.json({
      score,
      topReason: reason,
      eventsChecked: eventCount,
      averageTone: avgTone,
      rawToneSample: avgToneSample.slice(0, 10)
    });
  } catch (error) {
    console.error("❌ GDELT query error:", error);
    res.status(500).json({ error: "Failed to query GDELT data." });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 ShouldIFlee backend running on port ${PORT}`);
});
