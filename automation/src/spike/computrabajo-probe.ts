import { runProbe } from './run';

/**
 * Computrabajo. Se prueba antes que Indeed a propósito: sus términos pueden
 * ser distintos y conviene mirarlos antes de invertir en el adapter.
 */
runProbe('computrabajo', 'https://www.computrabajo.com.co/').catch((err) => {
  console.error('El spike falló:', err instanceof Error ? err.message : err);
  process.exit(1);
});
