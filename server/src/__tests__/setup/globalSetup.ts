import { MongoMemoryServer } from 'mongodb-memory-server';
import fs from 'fs';
import os from 'os';
import path from 'path';

export default async () => {
  const mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  (global as any).__MONGOD__ = mongod;
  fs.writeFileSync(path.join(os.tmpdir(), 'jest-mongo-uri.txt'), uri, 'utf8');
};
