import type { ModuleConfig } from '@/platform/types/module';

export const projectsModule: ModuleConfig = {
  id: 'projects',
  name: 'Proyectos',
  description:
    'Gestión integral de proyectos con estado, cliente, fechas y trazabilidad de entregables.',
  icon: 'FolderKanban',
  accent: 'violet',
  basePath: '/m/projects',
  status: 'active',
  permissions: ['projects:read'],
  nav: [],
  itemCount: 1,
  itemLabel: 'elementos',
};

export const aiModule: ModuleConfig = {
  id: 'ai',
  name: 'IA',
  description:
    'Procesamiento de audio con transcripción, traducción y análisis de reuniones por proyecto.',
  icon: 'Sparkles',
  accent: 'emerald',
  basePath: '/m/ia',
  status: 'disabled',
  permissions: ['ai:read'],
  nav: [],
  itemCount: 0,
  itemLabel: 'análisis',
};

export const proposalsModule: ModuleConfig = {
  id: 'proposals-v2',
  name: 'Propuestas',
  description:
    'Versionado, estado, comparación y exportación de propuestas por proyecto y cliente.',
  icon: 'FileText',
  accent: 'amber',
  basePath: '/m/propuestas',
  status: 'disabled',
  permissions: ['proposals:read'],
  nav: [],
  itemCount: 0,
  itemLabel: 'versiones',
};

export const configuredReportsModule: ModuleConfig = {
  id: 'configured-reports',
  name: 'Informes Configurados',
  description:
    'Elige fechas y descarga Excel estándar desde Google Sheets (plantillas con bloques).',
  icon: 'FileSpreadsheet',
  accent: 'sky',
  basePath: '/m/informes',
  status: 'active',
  permissions: ['reports:read'],
  nav: [],
  itemCount: 1,
  itemLabel: 'informes',
};
