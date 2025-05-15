const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { BigQuery } = require('@google-cloud/bigquery');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Point to your GCP service account key file
const bigquery = new BigQuery({
  keyFilename: path.join(__dirname, 'gdelt-key.json'),
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

    const negativeEvents = rows.filter(r => parseFloat(r.AvgTone) < 0);
    const avgTone = rows.length
      ? negativeEvents.reduce((sum, r) => sum + parseFloat(r.AvgTone), 0) / negativeEvents.length
      : 0;

    // Hybrid score: count of events + avgTone (negativity) boost
    let score = Math.min(Math.round(eventCount * 1.5 + (avgTone < 0 ? -avgTone * 10 : 0)), 100);
    let reason = eventCount > 0
      ? `${eventCount} events reported in ${country} with an average tone of ${avgTone.toFixed(2)}.`
      : `No significant events reported in ${country} over the last 30 days.`;

    res.json({ score, topReason: reason, eventsChecked: eventCount });
  } catch (error) {
    console.error("GDELT query error:", error);
    res.status(500).json({ error: "Failed to query GDELT data." });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
