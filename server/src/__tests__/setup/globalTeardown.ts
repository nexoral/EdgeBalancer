import fs from 'fs';
import os from 'os';
import path from 'path';

export default async () => {
  await (global as any).__MONGOD__.stop();
  const uriFile = path.join(os.tmpdir(), 'jest-mongo-uri.txt');
  if (fs.existsSync(uriFile)) {
    fs.unlinkSync(uriFile);
  }
};
