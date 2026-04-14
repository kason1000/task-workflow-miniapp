import { BaseLayout } from '../shared/BaseLayout';
import { DesignTaskList } from '../shared/DesignTaskList';
import { DesignTaskDetail } from '../shared/DesignTaskDetail';
import { mosaicRenderProps } from './MosaicTaskList';
import { mosaicDetailRenderProps } from './MosaicTaskDetail';
import { Task, Group } from '../../types';
import './mosaic.css';

interface MosaicLayoutProps {
  view: string; role: string; user: any; appVersion: string;
  groups: Group[]; selectedGroupId?: string; selectedTask: Task | null;
  refreshKey: number; onTaskClick: (task: Task) => void;
  onBack: (refresh?: boolean) => void; onTaskUpdated: (goBack?: boolean) => void;
  onGroupsClick: () => void; onLogout: () => void; onThemeClick: () => void;
  onGroupFilterChange?: (groupId: string | undefined) => void;
}

export function MosaicLayout(props: MosaicLayoutProps) {
  const listProps = mosaicRenderProps();
  const detailProps = mosaicDetailRenderProps();

  return (
    <BaseLayout
      {...props}
      designId="mosaic"
      renderTaskList={({ onTaskClick, groupId, refreshKey }) => (
        <DesignTaskList
          onTaskClick={onTaskClick}
          groupId={groupId}
          refreshKey={refreshKey}
          {...listProps}
        />
      )}
      renderTaskDetail={({ task, userRole, onBack, onTaskUpdated }) => (
        <DesignTaskDetail
          task={task}
          userRole={userRole}
          onBack={onBack}
          onTaskUpdated={onTaskUpdated}
          {...detailProps}
        />
      )}
    />
  );
}

export default MosaicLayout;
