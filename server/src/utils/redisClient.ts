import { createClient, RedisClientType } from 'redis';

let client: RedisClientType | null = null;
let everConnected = false;
const onReconnectCallbacks: Array<() => Promise<void>> = [];

export function onRedisReconnect(callback: () => Promise<void>): void {
  onReconnectCallbacks.push(callback);
}

export async function getRedisClient(): Promise<RedisClientType> {
  if (!client) {
    client = createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379',
      username: process.env.REDIS_USERNAME || undefined,
      password: process.env.REDIS_PASSWORD || undefined,
      // Callers already degrade gracefully on a Redis error (the rate limiter skips, locks fail
      // open). Queueing commands while disconnected would hang those requests instead of erroring,
      // so the degradation never runs.
      disableOfflineQueue: true,
      socket: {
        port: process.env.REDIS_PORT ? Number(process.env.REDIS_PORT) : undefined,
        connectTimeout: 3000,
        // Unreachable at startup is fatal — a pod that hangs here never becomes ready and never
        // restarts. Once connected, retry forever so a blip does not permanently orphan the client.
        reconnectStrategy: (retries) =>
          !everConnected && retries > 10
            ? new Error('Redis unreachable at startup')
            : Math.min(retries * 100, 3000),
      },
    }) as RedisClientType;
    client.on('error', (err) => console.error('Redis error:', err.message));
    client.on('ready', () => { everConnected = true; });
    client.on('reconnecting', async () => {
      console.log('Redis reconnecting — running recovery callbacks');
      for (const cb of onReconnectCallbacks) {
        try {
          await cb();
        } catch (err: any) {
          console.error('Redis reconnect callback failed:', err.message);
        }
      }
    });
    await client.connect();
    console.log('Redis connected');
  }
  return client;
}

export async function closeRedisClient(): Promise<void> {
  if (client) {
    await client.quit();
    client = null;
    everConnected = false;
  }
}
