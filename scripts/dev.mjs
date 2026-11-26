// Modo desenvolvimento: sobe o Vite e abre o Electron apontando para ele.
import { createServer } from 'vite';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const electronPath = require('electron');

const server = await createServer({ configFile: new URL('../vite.config.mjs', import.meta.url).pathname });
await server.listen();
const url = server.resolvedUrls.local[0];
console.log(`Vite pronto em ${url}`);

const child = spawn(electronPath, ['.'], {
  stdio: 'inherit',
  env: { ...process.env, VITE_DEV_SERVER_URL: url },
});

child.on('close', async (code) => {
  await server.close();
  process.exit(code ?? 0);
});
