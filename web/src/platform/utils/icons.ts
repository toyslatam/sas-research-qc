import type { LucideIcon } from 'lucide-react';
import {
  BarChart3,
  BookOpen,
  Building2,
  ClipboardList,
  Eye,
  FileText,
  LayoutDashboard,
  Lightbulb,
  Mic,
  Users,
  Layers,
  FolderKanban,
  Sparkles,
  FileSpreadsheet,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  ScrollText,
  Plug,
  Webhook,
} from 'lucide-react';

const iconMap: Record<string, LucideIcon> = {
  LayoutDashboard,
  Users,
  Eye,
  FileText,
  Mic,
  BarChart3,
  Lightbulb,
  BookOpen,
  Layers,
  FolderKanban,
  Sparkles,
  FileSpreadsheet,
  Settings,
  ShieldCheck,
  Building2,
  ClipboardList,
  SlidersHorizontal,
  ScrollText,
  Plug,
  Webhook,
};

export function getModuleIcon(name: string): LucideIcon {
  return iconMap[name] ?? Layers;
}
