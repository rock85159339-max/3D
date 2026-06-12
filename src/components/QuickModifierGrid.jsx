import React from 'react';
import {
  ArrowDownToLine,
  Box,
  Combine,
  Copy,
  Crosshair,
  Eye,
  EyeOff,
  FlipHorizontal,
  FlipVertical,
  Grid3X3,
  Lock,
  Scissors,
  Trash2,
  Unlock,
  Users,
} from 'lucide-react';
import InspectorEmptyState from './InspectorEmptyState.jsx';
import QuickModifierButton from './QuickModifierButton.jsx';

function QuickGroup({ title, children }) {
  return (
    <div className="quick-modifier-group">
      <div className="quick-modifier-group-title">{title}</div>
      <div className="quick-modifier-grid">{children}</div>
    </div>
  );
}

export default function QuickModifierGrid({
  selectedObjects = [],
  onCenter,
  onDrop,
  onSetSolid,
  onSetHole,
  onApplyBoolean,
  onMerge,
  onDuplicate,
  onDelete,
  onMirrorX,
  onMirrorY,
  onPlaneCut,
  onArrayDuplicate,
  onGroup,
  onUngroup,
  onToggleLock,
  onToggleVisibility,
  onStub,
}) {
  const selectedCount = selectedObjects.length;
  const hasSelection = selectedCount > 0;
  const isMulti = selectedCount > 1;
  const solidCount = selectedObjects.filter((object) => object.userData.mode !== 'hole').length;
  const holeCount = selectedObjects.filter((object) => object.userData.mode === 'hole').length;
  const primarySelected = selectedObjects[0] || null;
  const isHole = selectedCount === 1 && primarySelected?.userData.mode === 'hole';
  const canPlaneCut = selectedCount === 1 && solidCount === 1 && holeCount === 0;
  const isLocked = selectedCount === 1 && !!primarySelected?.userData.locked;
  const isHidden = selectedCount === 1 && primarySelected?.visible === false;
  const canGroup = selectedCount >= 2;
  const canUngroup = selectedObjects.some((object) => object.isGroup);

  const notifyStub = (message) => {
    if (onStub) onStub(message);
  };

  return (
    <div className="quick-modifier-section">
      {!hasSelection && <InspectorEmptyState>選取物件後可使用快速修改器</InspectorEmptyState>}
      {isHole && (
        <p className="quick-modifier-hint">挖洞物件可用於套用打洞，不會直接列印。</p>
      )}
      {isMulti && solidCount === 1 && holeCount >= 1 && (
        <p className="quick-modifier-hint">可使用「套用打洞」將挖洞物件從實體中扣除。</p>
      )}

      <QuickGroup title="基本操作">
        <QuickModifierButton icon={Crosshair} label="置中到平台" tooltip="置中到平台" disabled={!hasSelection} onClick={onCenter} />
        <QuickModifierButton icon={ArrowDownToLine} label="貼齊平台" tooltip="貼齊平台" disabled={!hasSelection} onClick={onDrop} />
        <QuickModifierButton icon={Copy} label="複製" tooltip="複製選取物件" disabled={!hasSelection} onClick={onDuplicate} />
        <QuickModifierButton icon={Trash2} label="刪除" tooltip="刪除選取物件" disabled={!hasSelection} danger onClick={onDelete} />
      </QuickGroup>

      <QuickGroup title="類型 / 布林">
        <QuickModifierButton icon={Box} label="轉成實體" tooltip="轉成實體：設為一般實體物件" disabled={!hasSelection} active={hasSelection && holeCount === 0} onClick={onSetSolid} />
        <QuickModifierButton icon={Scissors} label="轉成挖洞" tooltip="轉成挖洞：設為半透明打洞物件" disabled={!hasSelection} active={hasSelection && solidCount === 0} onClick={onSetHole} />
        <QuickModifierButton icon={Scissors} label="套用打洞" tooltip="套用打洞：用挖洞物件扣除實體" disabled={selectedCount < 2} badge={solidCount >= 1 && holeCount >= 1 ? undefined : '!'} onClick={onApplyBoolean} />
        <QuickModifierButton icon={Combine} label="合併" tooltip="合併：合併多個實體" disabled={selectedCount < 2} badge={holeCount ? '!' : undefined} onClick={onMerge} />
      </QuickGroup>

      <QuickGroup title="變形">
        <QuickModifierButton icon={FlipHorizontal} label="X 鏡像" tooltip="鏡像 X：沿 X 軸鏡像" disabled={!hasSelection} onClick={onMirrorX || (() => notifyStub('X 鏡像下一版開放'))} />
        <QuickModifierButton icon={FlipVertical} label="Y 鏡像" tooltip="鏡像 Y：沿 Y 軸鏡像" disabled={!hasSelection} onClick={onMirrorY || (() => notifyStub('Y 鏡像下一版開放'))} />
        <QuickModifierButton icon={Scissors} label="切割" tooltip="用平面切割物件" disabled={!canPlaneCut} onClick={onPlaneCut || (() => notifyStub('平面切割下一版開放'))} />
        <QuickModifierButton icon={Grid3X3} label="陣列複製" tooltip="陣列複製：依設定複製多個物件" disabled={!hasSelection} onClick={onArrayDuplicate || (() => notifyStub('陣列複製下一版開放'))} />
        <QuickModifierButton icon={Users} label="群組" tooltip="群組選取物件" disabled={!canGroup} onClick={onGroup || (() => notifyStub('群組下一版開放'))} />
        <QuickModifierButton icon={Users} label="取消群組" tooltip="取消群組" disabled={!canUngroup} onClick={onUngroup || (() => notifyStub('請先選取群組'))} />
      </QuickGroup>

      <QuickGroup title="狀態">
        <QuickModifierButton icon={isLocked ? Unlock : Lock} label={isLocked ? '解鎖' : '鎖定'} tooltip={isLocked ? '解鎖物件' : '鎖定物件'} disabled={!hasSelection} active={isLocked} onClick={onToggleLock} />
        <QuickModifierButton icon={isHidden ? Eye : EyeOff} label={isHidden ? '顯示' : '隱藏'} tooltip={isHidden ? '顯示物件' : '隱藏物件'} disabled={!hasSelection} active={isHidden} onClick={onToggleVisibility} />
      </QuickGroup>
    </div>
  );
}
