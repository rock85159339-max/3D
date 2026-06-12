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
  runtimeLabel,
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
    edge: '邊編輯',
    vertex: '點編輯',
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
    ? '提示：Alt + 左鍵旋轉，滾輪縮放，滾輪拖曳或右鍵拖曳平移視角，F 聚焦選取'
    : '提示：左鍵拖曳旋轉視角，滾輪縮放，滾輪拖曳或右鍵拖曳平移視角，G/R/S 移動/旋轉/縮放，F 聚焦';
  const appName = appInfo.name === 'Print Modeler' ? '3D 列印建模器' : appInfo.name;

  return (
    <footer className="status-bar">
      <span>{appName} {version}</span>
      <span>{appInfo.repo}</span>
      <span>執行環境：{runtimeLabel}</span>
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
