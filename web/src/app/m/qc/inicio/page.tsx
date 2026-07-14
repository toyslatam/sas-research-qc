import { redirect } from 'next/navigation';

/** Compat: la entrada principal ahora es el dashboard. */
export default function QcInicioRedirectPage() {
  redirect('/m/qc/dashboard');
}
