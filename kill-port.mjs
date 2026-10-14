/**
 * kill-port.mjs — kills any process on PORT before dev server starts.
 * Uses netstat to catch both IPv4 and IPv6 bindings on Windows.
 */
import { execSync } from 'child_process';

const PORT = 3001;

function killPort(port) {
  try {
    // Find all PIDs listening on the port (IPv4 + IPv6)
    const raw = execSync(
      `netstat -ano | findstr :${port}`,
      { shell: 'cmd.exe', encoding: 'utf8' }
    );
    const pids = new Set();
    raw.split('\n').forEach(line => {
      const parts = line.trim().split(/\s+/);
      // Only LISTENING lines — parts[3] is local address, parts[4] is state, parts[5] is PID  
      // Format: Proto  Local  Foreign  State  PID
      if (parts.length >= 5 && (parts[3] === 'LISTENING' || parts[3] === 'LISTENING')) {
        const pid = parseInt(parts[parts.length - 1]);
        if (pid && pid !== 0) pids.add(pid);
      }
    });
    if (pids.size === 0) {
      // Fallback: grab any PID from output
      raw.split('\n').forEach(line => {
        const m = line.match(/:3001\s+\S+\s+\w+\s+(\d+)/);
        if (m) {
          const pid = parseInt(m[1]);
          if (pid !== 0) pids.add(pid);
        }
      });
    }
    if (pids.size === 0) return false;
    for (const pid of pids) {
      try {
        execSync(`taskkill /PID ${pid} /F`, { shell: 'cmd.exe' });
        console.log(`✓  Freed port ${port} (killed PID ${pid})`);
      } catch(_) {}
    }
    // Wait for OS to release
    execSync('timeout /t 1 /nobreak >nul', { shell: 'cmd.exe' });
    return true;
  } catch (_) {
    return false;
  }
}

const killed = killPort(PORT);
if (!killed) {
  console.log(`✓  Port ${PORT} is free.`);
}
