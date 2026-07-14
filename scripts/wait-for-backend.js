/**
 * Espera a que el backend responda en /api/health.
 * Uso: node scripts/wait-for-backend.js [url] [timeoutSec]
 */
const http = require('http');

const baseUrl = process.argv[2] || 'http://127.0.0.1:4000';
const timeoutSec = Number(process.argv[3] || 45);
const deadline = Date.now() + timeoutSec * 1000;

function check() {
  return new Promise((resolve) => {
    const req = http.get(`${baseUrl}/api/health`, (res) => {
      res.resume();
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(3000, () => {
      req.destroy();
      resolve(false);
    });
  });
}

(async () => {
  while (Date.now() < deadline) {
    if (await check()) {
      console.log(`[wait-for-backend] OK en ${baseUrl}`);
      process.exit(0);
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  console.error(`[wait-for-backend] Timeout: backend no respondio en ${timeoutSec}s (${baseUrl})`);
  process.exit(1);
})();
