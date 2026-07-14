import type { ModuleConfig } from '@/platform/types/module';

export const whispperResearchModule: ModuleConfig = {
  id: 'whispper-research',
  name: 'Research Intelligence',
  description:
    'Análisis de entrevistas, propuestas exploratorias, fichas de proveedores y cuestionarios de investigación de mercado.',
  icon: 'Mic',
  accent: 'cyan',
  basePath: '/m/whispper-research',
  defaultPath: 'resumen',
  status: 'active',
  permissions: ['research:read'],
  itemCount: 8,
  itemLabel: 'secciones',
  nav: [
    { path: 'resumen', label: 'Resumen', icon: 'LayoutDashboard' },
    { path: 'participants', label: 'Proveedores', icon: 'Users' },
    { path: 'providers', label: 'Ficha', icon: 'Eye' },
    { path: 'proposals', label: 'Propuestas', icon: 'FileText' },
    { path: 'exploratory', label: 'Exploratorio', icon: 'Mic' },
    { path: 'analysis', label: 'Análisis', icon: 'BarChart3' },
    { path: 'insights', label: 'Insights', icon: 'Lightbulb' },
    { path: 'cuestionario', label: 'Cuestionario', icon: 'BookOpen' },
  ],
};
