import { BaseLayout } from '../shared/BaseLayout';
import { DesignTaskList } from '../shared/DesignTaskList';
import { DesignTaskDetail } from '../shared/DesignTaskDetail';
import { glassRenderProps } from './GlassTaskList';
import { glassDetailRenderProps } from './GlassTaskDetail';
import { Task, Group } from '../../types';
import './glass.css';

interface GlassLayoutProps {
  view: string; role: string; user: any; appVersion: string;
  groups: Group[]; selectedGroupId?: string; selectedTask: Task | null;
  refreshKey: number; onTaskClick: (task: Task) => void;
  onBack: (refresh?: boolean) => void; onTaskUpdated: (goBack?: boolean) => void;
  onGroupsClick: () => void; onLogout: () => void; onThemeClick: () => void;
  onGroupFilterChange?: (groupId: string | undefined) => void;
}

export function GlassLayout(props: GlassLayoutProps) {
  const listProps = glassRenderProps();
  const detailProps = glassDetailRenderProps();
  return (
    <BaseLayout {...props} designId="glass"
      renderTaskList={({ onTaskClick, groupId, refreshKey }) => (
        <DesignTaskList onTaskClick={onTaskClick} groupId={groupId} refreshKey={refreshKey} {...listProps} />
      )}
      renderTaskDetail={({ task, userRole, onBack, onTaskUpdated }) => (
        <DesignTaskDetail task={task} userRole={userRole} onBack={onBack} onTaskUpdated={onTaskUpdated} {...detailProps} />
      )}
    />
  );
}
export default GlassLayout;
