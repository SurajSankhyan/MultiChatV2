require('dotenv').config();
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');

// Verify required environment variables
const REQUIRED_ENV = [
  'PROJECT_1_JWT_SECRET',
  'PROJECT_2_JWT_SECRET'
];
const missingEnv = REQUIRED_ENV.filter(key => !process.env[key]);
if (missingEnv.length > 0) {
  console.warn(`WARNING: Missing environment variables: ${missingEnv.join(', ')}`);
  console.warn(`Please set these in your Render Dashboard or .env file before running.`);
}

const app = express();
const PORT = process.env.PORT || 4000;

// Enable CORS
app.use(cors({
  origin: '*', // For production, replace '*' with your specific frontend domains
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// Health Check Endpoint (For Render uptime checks)
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'Token Swap Bridge is healthy' });
});

// Helper to normalize and resolve keys and algorithms (supports standard HS256, PEM ES256, and JWKS JSON formats)
const resolveKeyAndAlgorithm = (rawKey, isSigning = false) => {
  if (!rawKey) return { key: '', algorithm: 'HS256' };
  const cleanKey = rawKey.trim();

  // Handle JWKS JSON format (e.g. from Supabase Public key set)
  if (cleanKey.startsWith('{')) {
    try {
      const jwks = JSON.parse(cleanKey);
      const keys = jwks.keys || [jwks];
      const keyObj = keys[0];
      const crypto = require('crypto');
      const publicKey = crypto.createPublicKey({ format: 'jwk', key: keyObj });
      const pem = publicKey.export({ type: 'spki', format: 'pem' });
      return { key: pem, algorithm: 'ES256' };
    } catch (err) {
      console.error('Failed to parse JWKS JSON key:', err.message);
    }
  }

  // Handle standard PEM or symmetric keys
  const normalized = cleanKey.replace(/\\n/g, '\n');
  const isAsymmetric = normalized.includes('PUBLIC KEY') || normalized.includes('PRIVATE KEY') || normalized.includes('BEGIN');
  
  return {
    key: normalized,
    algorithm: isAsymmetric ? 'ES256' : 'HS256'
  };
};

// Token Swap Endpoint
app.post('/api/swap', (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or malformed Authorization header' });
  }

  const token1 = authHeader.split(' ')[1];

  try {
    // 1. Verify Project 1 Token
    if (!process.env.PROJECT_1_JWT_SECRET) {
      return res.status(500).json({ error: 'Server misconfiguration: PROJECT_1_JWT_SECRET is missing' });
    }
    
    const { key: key1, algorithm: verifyAlgorithm } = resolveKeyAndAlgorithm(process.env.PROJECT_1_JWT_SECRET);
    
    // Verify using Project 1 key and detected algorithm
    const decoded = jwt.verify(token1, key1, {
      algorithms: [verifyAlgorithm]
    });
    
    // 2. Validate payload has the user UUID (sub)
    const userUuid = decoded.sub;
    if (!userUuid) {
      return res.status(400).json({ error: 'Invalid token payload: missing sub (UUID)' });
    }

    // 3. Prepare payload for Project 2 Token
    const payload = {
      ...decoded,
      iss: 'supabase',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600 // Valid for 1 hour
    };

    // 4. Sign the new token for Project 2 using Project 2's key and detected algorithm
    if (!process.env.PROJECT_2_JWT_SECRET) {
      return res.status(500).json({ error: 'Server misconfiguration: PROJECT_2_JWT_SECRET is missing' });
    }

    const { key: key2, algorithm: signAlgorithm } = resolveKeyAndAlgorithm(process.env.PROJECT_2_JWT_SECRET);

    const token2 = jwt.sign(payload, key2, {
      algorithm: signAlgorithm
    });

    // 5. Send back the swapped token
    return res.status(200).json({
      access_token: token2,
      token_type: 'bearer',
      expires_in: 3600,
      user: {
        id: userUuid,
        email: decoded.email || '',
        user_metadata: decoded.user_metadata || {}
      }
    });

  } catch (err) {
    console.error('Token swap verification failed:', err.message);
    return res.status(401).json({ error: 'Invalid or expired Project 1 token' });
  }
});

app.listen(PORT, () => {
  console.log(`==================================================`);
  console.log(` Supabase Token Swap Bridge running on port ${PORT}`);
  console.log(` Ready to swap tokens between Project 1 and 2`);
  console.log(`==================================================`);
});
