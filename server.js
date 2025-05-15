const express = require('express');
const cors = require('cors');
const app = express();
const port = process.env.PORT || 3000;

// CORS setup: allow specific origins in production, all in dev
const allowedOrigins = [
  'https://shouldiflee.com',
  'http://localhost:3000' // Dev/test origin
];

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like curl, mobile apps)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('CORS not allowed from this origin: ' + origin), false);
  }
}));

// Example scoring function — replace this with your own logic
async function calculateFleeScore(country) {
  // Simulate fetching GDELT data (replace with real query)
  const fakeData = {
    score: Math.random() * 10 - 5, // from -5 to +5
    avgTone: -3.4,
    sampleTones: [-2.1, -3.5, -4.7],
    eventCount: 129
  };

  // Simulate error if country is missing tone
  if (!country || country === 'Atlantis') {
    return {
      score: null,
      avgTone: null,
      sampleTones: [],
      eventCount: 0
    };
  }

  return fakeData;
}

// Flee Score API endpoint
app.get('/api/flee_score', async (req, res) => {
  try {
    const country = req.query.country;
    if (!country) return res.status(400).json({ error: 'Missing country parameter' });

    const result = await calculateFleeScore(country);

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
});

// Root route (optional)
app.get('/', (req, res) => {
  res.send('ShouldIFlee API is running');
});

// Start server
app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
