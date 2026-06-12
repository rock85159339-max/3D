import React from 'react';

export default function StatusBar({
  workflow,
  editMode,
  mode,
  selectedCount,
  lockedAxis,
  brushMode,
  boxSelectActive,
  operationStatus,
  transformSpace,
  version,
  runtimeLabel,
}) {
  const workflowLabels = {
    model: '建立',
    face: '編輯',
    sculpt: '雕刻',
    prep: '修復',
    export: '匯出',
  };
  const modeLabels = {
    object: '物件',
    face: '面',
    edge: '邊',
    vertex: '點',
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
    ? `筆刷：${toolLabels[brushMode] || brushMode}`
    : boxSelectActive
      ? '框選'
      : toolLabels[mode] || mode;

  return (
    <footer className="status-bar">
      <span>3D列印建模器 {version}</span>
      <span>執行環境：{runtimeLabel}</span>
      <span>流程：{workflowLabels[workflow] || workflow}</span>
      <span>模式：{modeLabels[editMode] || editMode}</span>
      <span>工具：{tool}</span>
      <span>選取：{selectedCount}</span>
      <span>軸向：{lockedAxis ? lockedAxis.toUpperCase() : '無'}</span>
      <span>座標：{transformSpace === 'local' ? '本地' : '世界'}</span>
      <span>狀態：{operationStatus || '就緒'}</span>
      <span className="status-hint">左鍵旋轉｜滾輪縮放｜中鍵/右鍵平移｜G/R/S｜F 聚焦｜Del 刪除</span>
    </footer>
  );
}
