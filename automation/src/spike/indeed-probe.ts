import { runProbe } from './run';

/**
 * Uso:
 *   1ª corrida → inicias sesión a mano; queda guardada en el perfil.
 *   2ª corrida → NO debería pedirte nada. Eso es lo que valida el modelo.
 */
runProbe('indeed', 'https://employers.indeed.com/').catch((err) => {
  console.error('El spike falló:', err instanceof Error ? err.message : err);
  process.exit(1);
});
