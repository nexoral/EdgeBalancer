/**
 * EdgeBalancer Server Entry Point
 * Fastify-based API server with MongoDB, JWT auth, and Firebase integration
 */
import dotenv from 'dotenv';
import { connectDatabase, disconnectDatabase } from './utils/database';
import { buildServer } from './app';
import type { FastifyInstance } from 'fastify';

dotenv.config();

// Validate required environment variables
const requiredEnvVars = [
  'MONGODB_URI',
  'JWT_SECRET',
  'ENCRYPTION_KEY',
  'CLIENT_URL',
];

const missingEnvVars = requiredEnvVars.filter((varName) => !process.env[varName]);

if (missingEnvVars.length > 0) {
  console.error('❌ Missing required environment variables:');
  missingEnvVars.forEach((varName) => {
    console.error(`   - ${varName}`);
  });
  console.error('\nPlease check your .env file and ensure all required variables are set.');
  process.exit(1);
}

// Validate ENCRYPTION_KEY length (must be 64 characters for 32-byte hex)
if (process.env.ENCRYPTION_KEY && process.env.ENCRYPTION_KEY.length !== 64) {
  console.error('❌ ENCRYPTION_KEY must be exactly 64 characters (32-byte hex string)');
  process.exit(1);
}

const PORT = process.env.PORT || 8000;

// Store app instance for graceful shutdown
let app: FastifyInstance | null = null;

// Graceful shutdown handler
async function gracefulShutdown(signal: string) {
  console.log(`\n📡 Received ${signal}, starting graceful shutdown...`);

  try {
    // Close Fastify server (stops accepting new connections)
    if (app) {
      await app.close();
      console.log('✅ Fastify server closed');
    }

    // Disconnect from MongoDB
    await disconnectDatabase();

    console.log('✅ Graceful shutdown complete');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during shutdown:', error);
    process.exit(1);
  }
}

// Register signal handlers
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// Bootstrap server with proper async initialization
async function bootstrap() {
  try {
    // Connect to database first
    await connectDatabase();

    // Then build and start server
    app = await buildServer();

    await app.listen({ port: Number(PORT), host: '0.0.0.0' });

    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📚 API Docs: http://localhost:${PORT}/api-docs`);
    console.log(`🔄 Idempotency: Enabled (in-memory)`);
  } catch (error) {
    console.error('❌ Failed to start server');
    console.error(error);
    process.exit(1);
  }
}

bootstrap();
