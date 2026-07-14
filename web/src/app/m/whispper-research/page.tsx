import { redirect } from 'next/navigation';
import { whispperResearchModule } from '@/modules/whispper-research/config';
import { getModuleEntryHref } from '@/platform/registry';

export default function WhispperResearchIndexPage() {
  redirect(getModuleEntryHref(whispperResearchModule));
}
