const express = require('express');
const axios = require('axios');
const csv = require('csv-parser');
const fs = require('fs');
const dayjs = require('dayjs');
const { pipeline } = require('stream');
const app = express();
const PORT = process.env.PORT || 3000;

const today = dayjs().format('YYYYMMDD');
const GDELT_URL = `http://data.gdeltproject.org/gdeltv2/${today}*.export.CSV.zip`;
const VIOLENCE_CODES = ['19', '20', '21', '23', '1122', '171', '172', '173', '138']; // Add/adjust as needed

// Flee score weights
const WEIGHTS = {
  tone: 2.5,         // Negative tone increases flee risk
  goldstein: 1.2,    // Higher magnitude = more impact
  violence: 5,       // Bonus for violence-related codes
  articles: 0.5      // More coverage = higher concern
};

// Thresholds
const FLEE_THRESHOLDS = {
  yes: 15,
  maybe: 7
};

function calculateScore(events) {
  let score = 0;

  for (const event of events) {
    const tone = parseFloat(event.AvgTone);
    const goldstein = parseFloat(event.GoldsteinScale);
    const articles = parseInt(event.NumArticles || '1');
    const rootCode = event.EventRootCode || '';

    const isViolent = VIOLENCE_CODES.includes(rootCode);
    let eventScore = 0;

    if (!isNaN(tone)) eventScore += Math.abs(tone) * WEIGHTS.tone;
    if (!isNaN(goldstein)) eventScore += Math.abs(goldstein) * WEIGHTS.goldstein;
    if (!isNaN(articles)) eventScore += Math.log(articles + 1) * WEIGHTS.articles;
    if (isViolent) eventScore += WEIGHTS.violence;

    score += eventScore;
  }

  return Math.round(score);
}

function determineFleeStatus(score) {
  if (score >= FLEE_THRESHOLDS.yes) return 'YES';
  if (score >= FLEE_THRESHOLDS.maybe) return 'MAYBE';
  return 'NO';
}

app.get('/api/flee-score', async (req, res) => {
  const country = (req.query.country || '').trim().toUpperCase();

  if (!country) {
    return res.status(400).json({ error: 'Country parameter is required' });
  }

  try {
    const url = `http://data.gdeltproject.org/gdeltv2/${today}.export.CSV.zip`;

    // Download and unzip CSV
    const zip = await axios.get(url, { responseType: 'arraybuffer' });
    const AdmZip = require('adm-zip');
    const tempZip = new AdmZip(zip.data);
    const zipEntries = tempZip.getEntries();

    const matchedEntry = zipEntries.find(entry => entry.entryName.endsWith('.CSV'));

    if (!matchedEntry) throw new Error('CSV not found in zip.');

    const csvData = matchedEntry.getData().toString('utf8');

    // Write to temp file for parsing
    const tempFile = './temp.csv';
    fs.writeFileSync(tempFile, csvData);

    const filteredEvents = [];
    fs.createReadStream(tempFile)
      .pipe(csv({ headers: false }))
      .on('data', row => {
        try {
          const countryCode = row[51]; // Actor1CountryCode
          if (countryCode && countryCode.toUpperCase() === country) {
            filteredEvents.push({
              AvgTone: row[34],
              GoldsteinScale: row[30],
              EventRootCode: row[26],
              NumArticles: row[60]
            });
          }
        } catch (err) {
          // skip row
        }
      })
      .on('end', () => {
        const score = calculateScore(filteredEvents);
        const status = determineFleeStatus(score);
        res.json({
          country,
          status,
          score,
          eventCount: filteredEvents.length
        });

        fs.unlinkSync(tempFile);
      });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to retrieve or process GDELT data' });
  }
});

app.listen(PORT, () => {
  console.log(`ShouldIFlee server running on port ${PORT}`);
});
