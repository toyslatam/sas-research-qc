import type { ModuleConfig } from '@/platform/types/module';

export const qcModule: ModuleConfig = {
  id: 'qc',
  name: 'Control de Calidad',
  description:
    'Plataforma multiempresa de QC para investigación de mercados: revisiones, reglas, evidencias y auditoría.',
  icon: 'ShieldCheck',
  accent: 'orange',
  basePath: '/m/qc',
  defaultPath: 'dashboard',
  status: 'active',
  permissions: ['qc:projects:read'],
  itemCount: 12,
  itemLabel: 'secciones',
  nav: [
    { path: 'dashboard', label: 'Dashboard', icon: 'LayoutDashboard' },
    { path: 'encuestas', label: 'Encuestas', icon: 'ClipboardList' },
    { path: 'encuestadores', label: 'Encuestadores', icon: 'UserSearch' },
    { path: 'reglas', label: 'Reglas', icon: 'SlidersHorizontal' },
    { path: 'reportes', label: 'Reportes', icon: 'FileSpreadsheet' },
    { path: 'integraciones', label: 'Integraciones', icon: 'Plug' },
    { path: 'webhooks', label: 'Webhooks', icon: 'Webhook' },
    { path: 'auditoria', label: 'Auditoría', icon: 'ScrollText' },
    { path: 'proyectos', label: 'Proyectos', icon: 'FolderKanban' },
    { path: 'clientes', label: 'Clientes', icon: 'Building2' },
    { path: 'organizacion', label: 'Organización', icon: 'Settings' },
    { path: 'miembros', label: 'Miembros', icon: 'Users' },
  ],
};
