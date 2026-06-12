import React from 'react';
import {
  Box,
  Circle,
  CircleSlash,
  Cylinder,
  Download,
  FilePlus2,
  FolderOpen,
  Group,
  Merge,
  Move3D,
  RotateCw,
  Save,
  Scale,
  Scissors,
  SearchCheck,
  Type,
  Ungroup,
  Upload,
} from 'lucide-react';
import IconButton from './IconButton.jsx';
import ToolGroup from './ToolGroup.jsx';

export default function MainIconToolbar({
  activeWorkflow,
  transformMode,
  hasSelection,
  selectedCount,
  canBoolean,
  canMerge,
  onWorkflow,
  onNew,
  onOpen,
  onSave,
  onImport,
  onExportStl,
  onExportObj,
  onAddShape,
  onAddText,
  onSetTransformMode,
  onCenter,
  onDrop,
  onPlaneCut,
  onSetSolid,
  onSetHole,
  onBoolean,
  onMerge,
  onGroup,
  onUngroup,
  onCheck,
}) {
  return (
    <nav className="main-icon-toolbar" aria-label="主工具列">
      <ToolGroup label="檔案">
        <IconButton icon={FilePlus2} label="新建" onClick={onNew} />
        <IconButton icon={FolderOpen} label="開啟 JSON" onClick={onOpen} />
        <IconButton icon={Save} label="儲存 JSON" onClick={onSave} />
        <IconButton icon={Upload} label="匯入 STL/OBJ" onClick={onImport} />
        <IconButton icon={Download} label="匯出 STL" active={activeWorkflow === 'export'} onClick={onExportStl} />
        <IconButton icon={Download} label="匯出 OBJ" onClick={onExportObj} />
      </ToolGroup>

      <ToolGroup label="建立">
        <IconButton icon={Box} label="新增方塊" onClick={() => onAddShape('cube')} />
        <IconButton icon={Circle} label="新增球體" onClick={() => onAddShape('sphere')} />
        <IconButton icon={Cylinder} label="新增圓柱" onClick={() => onAddShape('cylinder')} />
        <IconButton icon={Circle} label="新增圓環" onClick={() => onAddShape('torus')} badge="T" />
        <IconButton icon={Cylinder} label="新增圓錐" onClick={() => onAddShape('cone')} badge="▲" />
        <IconButton icon={Type} label="新增 3D 文字" onClick={onAddText} />
      </ToolGroup>

      <ToolGroup label="變換">
        <IconButton icon={Move3D} label="移動" shortcut="G" active={transformMode === 'translate'} onClick={() => onSetTransformMode('translate')} />
        <IconButton icon={RotateCw} label="旋轉" shortcut="R" active={transformMode === 'rotate'} onClick={() => onSetTransformMode('rotate')} />
        <IconButton icon={Scale} label="縮放" shortcut="S" active={transformMode === 'scale'} onClick={() => onSetTransformMode('scale')} />
        <IconButton icon={Move3D} label="置中到平台" disabled={!hasSelection} onClick={onCenter} />
        <IconButton icon={Download} label="貼齊平台" disabled={!hasSelection} onClick={onDrop} />
        <IconButton icon={Scissors} label="平面切割" tooltip="平面切割" disabled={!hasSelection} onClick={onPlaneCut} />
      </ToolGroup>

      <ToolGroup label="布林 / 組合">
        <IconButton icon={Box} label="轉成實體" disabled={!hasSelection} onClick={onSetSolid} />
        <IconButton icon={CircleSlash} label="轉成挖洞" disabled={!hasSelection} onClick={onSetHole} />
        <IconButton icon={Scissors} label="套用挖洞" active={activeWorkflow === 'model' && canBoolean} disabled={!canBoolean} onClick={onBoolean} />
        <IconButton icon={Merge} label="合併" disabled={!canMerge} onClick={onMerge} />
        <IconButton icon={Group} label="群組" disabled={selectedCount < 2} onClick={onGroup} />
        <IconButton icon={Ungroup} label="解散群組" disabled={!hasSelection} onClick={onUngroup} />
      </ToolGroup>

      <ToolGroup label="輸出">
        <IconButton icon={SearchCheck} label="列印檢查" active={activeWorkflow === 'prep'} onClick={onCheck} />
        <IconButton icon={Download} label="切到匯出" active={activeWorkflow === 'export'} onClick={() => onWorkflow('export')} />
      </ToolGroup>
    </nav>
  );
}
