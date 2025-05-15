import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Dynamically allow all origins (for now)
app.use(cors({
  origin: function (origin, callback) {
    callback(null, origin || '*');
  }
}));

// Helper to calculate flee score
const calculateFleeScore = async (country) => {
  const countryParam = encodeURIComponent(country);
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const gdeltURL = `https://storage.googleapis.com/gedebucket/v2/events/${today}.export.csv`;

  try {
    const response = await fetch(gdeltURL);
    if (!response.ok) throw new Error(`Failed to fetch GDELT data: ${response.status}`);

    const csv = await response.text();
    const rows = csv.trim().split('\n').slice(1); // remove header
    const events = rows.map(row => row.split('\t')).filter(e => e[51] === country);

    const avgTone = events.length > 0
      ? events.map(e => parseFloat(e[34])).reduce((a, b) => a + b, 0) / events.length
      : 0;

    const goldstein = events.map(e => parseFloat(e[30]));
    const avgGoldstein = goldstein.length ? goldstein.reduce((a, b) => a + b, 0) / goldstein.length : 0;

    const score = Math.round((avgTone * -2 + avgGoldstein * -1.5 + events.length * 0.01) * 10);

    return {
      score,
      avgTone: parseFloat(avgTone.toFixed(2)),
      eventCount: events.length,
      sampleTones: events.slice(0, 5).map(e => parseFloat(e[34]))
    };
  } catch (err) {
    console.error('Score calculation failed:', err);
    return null;
  }
};

// Shared handler for both routes
const fleeScoreHandler = async (req, res) => {
  try {
    const country = req.query.country;
    if (!country) return res.status(400).json({ error: 'Missing country parameter' });

    const result = await calculateFleeScore(country);
    if (!result) return res.status(500).json({ error: 'Failed to calculate score' });

    res.json({
      score: result?.score ?? null,
      avgTone: result?.avgTone ?? null,
      sampleTones: result?.sampleTones ?? [],
      eventCount: result?.eventCount ?? 0
    });
  } catch (err) {
    console.error('Flee Score Error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Support both dash and underscore URLs
app.get('/api/flee_score', fleeScoreHandler);
app.get('/api/flee-score', fleeScoreHandler);

app.get('/', (req, res) => {
  res.send('Should I Flee API is running!');
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
