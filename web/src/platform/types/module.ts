export type ModuleStatus = 'active' | 'coming_soon' | 'disabled';

export type ModuleAccent =
  | 'cyan'
  | 'violet'
  | 'amber'
  | 'sky'
  | 'emerald'
  | 'slate'
  | 'rose'
  | 'orange';

export interface ModuleNavItem {
  path: string;
  label: string;
  icon: string;
}

export interface ModuleConfig {
  id: string;
  name: string;
  description: string;
  icon: string;
  accent: ModuleAccent;
  basePath: string;
  status: ModuleStatus;
  permissions: string[];
  nav: ModuleNavItem[];
  /** First route when entering the module (e.g. "resumen"). */
  defaultPath?: string;
  /** Placeholder count for launcher cards (phase 3). */
  itemCount?: number;
  /** Label for count, e.g. "elementos", "secciones". */
  itemLabel?: string;
}

export interface ResolvedModule extends ModuleConfig {
  href: string;
  enabled: boolean;
}
