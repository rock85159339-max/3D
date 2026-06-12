import React from 'react';

export default function StatusBar({
  workflow,
  editMode,
  mode,
  selectedCount,
  lockedAxis,
  operationStyle,
  brushMode,
  boxSelectActive,
  operationStatus,
  transformSpace,
  appInfo,
  version,
}) {
  const workflowLabels = {
    model: '建立模型',
    face: '編輯形狀',
    sculpt: '雕刻模型',
    prep: '列印修復',
    export: '匯出檔案',
  };
  const modeLabels = {
    object: '物件',
    face: '面編輯',
    sculpt: '雕刻',
  };
  const toolLabels = {
    translate: '移動',
    rotate: '旋轉',
    scale: '縮放',
    raise: '推起',
    lower: '壓下',
    smooth: '平滑',
    inflate: '膨脹',
    flatten: '壓平',
  };

  const tool = editMode === 'sculpt'
    ? `雕刻筆刷：${toolLabels[brushMode] || brushMode}`
    : boxSelectActive
      ? '框選'
      : toolLabels[mode] || mode;
  const hint = operationStyle === 'maya'
    ? '提示：Alt + 左鍵旋轉，Alt + 中鍵平移，Alt + 右鍵縮放，F 聚焦，Delete 刪除，Ctrl+Z 復原'
    : '提示：中鍵旋轉視角，Shift + 中鍵平移，G 移動，R 旋轉，S 縮放，Delete 刪除，Ctrl+Z / Ctrl+Y';
  const appName = appInfo.name === 'Print Modeler' ? '3D 列印建模器' : appInfo.name;

  return (
    <footer className="status-bar">
      <span>{appName} {version}</span>
      <span>{appInfo.repo}</span>
      <span>流程：{workflowLabels[workflow] || workflow}</span>
      <span>模式：{modeLabels[editMode] || editMode}</span>
      <span>工具：{tool}</span>
      <span>選取：{selectedCount}</span>
      <span>軸向：{lockedAxis ? lockedAxis.toUpperCase() : '無'}</span>
      <span>座標：{transformSpace === 'local' ? '本地' : '世界'}</span>
      <span>狀態：{operationStatus || '就緒'}</span>
      <span>{hint}</span>
    </footer>
  );
}
