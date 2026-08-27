import type { ModuleConfig } from '@/platform/types/module';

/**
 * Módulo independiente "Verificación de Voz": grabación de entrevistas de campo
 * (encuestador) + revisión de coincidencias de voz para QC (admin). Separado de
 * Control de Calidad, con organizaciones propias.
 */
export const voiceModule: ModuleConfig = {
  id: 'voice',
  name: 'Verificación de Voz',
  description:
    'Grabación de entrevistas de campo y revisión de coincidencias de voz como apoyo al control de calidad.',
  icon: 'Mic',
  accent: 'violet',
  basePath: '/m/voz',
  defaultPath: 'grabar',
  status: 'active',
  permissions: [],
  itemCount: 3,
  itemLabel: 'secciones',
  nav: [
    { path: 'grabar', label: 'Grabar', icon: 'Mic' },
    { path: 'grabaciones', label: 'Grabaciones', icon: 'ClipboardList' },
    { path: 'organizacion', label: 'Organización', icon: 'Settings' },
  ],
};
