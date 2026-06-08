import fs from 'fs';
import os from 'os';
import path from 'path';

const uriFile = path.join(os.tmpdir(), 'jest-mongo-uri.txt');
const mongoUri = fs.existsSync(uriFile)
  ? fs.readFileSync(uriFile, 'utf8').trim()
  : 'mongodb://localhost/edgebalancer-test';

process.env.MONGODB_URI = mongoUri;
process.env.JWT_SECRET = 'test-jwt-secret-for-jest-do-not-use-in-production';
// 64 hex chars = 32 bytes required by AES-256
process.env.ENCRYPTION_KEY = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
process.env.NODE_ENV = 'test';
process.env.PORT = '0';
process.env.CLIENT_URL = 'http://localhost:3000';
process.env.CORS_ORIGIN = 'http://localhost:3000';
