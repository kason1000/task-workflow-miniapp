import { BaseLayout } from '../shared/BaseLayout';
import { Task, Group } from '../../types';

interface RetroLayoutProps {
  view: string; role: string; user: any; appVersion: string;
  groups: Group[]; selectedGroupId?: string; selectedTask: Task | null;
  refreshKey: number; onTaskClick: (task: Task) => void;
  onBack: (refresh?: boolean) => void; onTaskUpdated: (goBack?: boolean) => void;
  onGroupsClick: () => void; onLogout: () => void; onThemeClick: () => void;
  onGroupFilterChange?: (groupId: string | undefined) => void;
}

export function RetroLayout(props: RetroLayoutProps) {
  return <BaseLayout {...props} designId="retro" />;
}

export default RetroLayout;
