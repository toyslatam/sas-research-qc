/**
 * Libera un puerto TCP en Windows (p. ej. Vite 5173 tras un Electron zombie).
 * Uso: node scripts/free-port.js 5173
 */
const { execSync } = require('child_process');

const port = process.argv[2];
if (!port) {
  process.exit(0);
}

if (process.platform !== 'win32') {
  process.exit(0);
}

try {
  const out = execSync(`netstat -ano | findstr ":${port}"`, { encoding: 'utf8' });
  const pids = new Set();

  for (const line of out.split('\n')) {
    if (!line.includes('LISTENING')) continue;
    const parts = line.trim().split(/\s+/);
    const pid = parts[parts.length - 1];
    if (pid && pid !== '0') pids.add(pid);
  }

  for (const pid of pids) {
    try {
      execSync(`taskkill /F /PID ${pid}`, { stdio: 'ignore' });
      console.log(`[free-port] Puerto ${port}: proceso ${pid} terminado`);
    } catch {
      // proceso ya cerrado
    }
  }
} catch {
  // puerto libre
}
