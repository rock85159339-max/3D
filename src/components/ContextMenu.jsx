import React from 'react';

export default function ContextMenu({
  menu,
  hasSelection,
  hasClipboard,
  onDuplicate,
  onCopy,
  onPaste,
  onDelete,
  onSolid,
  onHole,
  onPlace,
  onCenter,
  onApply,
  onFocus,
  onAddShape,
}) {
  return (
    <div className="context-menu" style={{ left: menu.x, top: menu.y }} onClick={(event) => event.stopPropagation()}>
      {menu.type === 'object' ? (
        <>
          <button disabled={!hasSelection} onClick={onCopy}>複製到剪貼簿</button>
          <button disabled={!hasSelection} onClick={onDuplicate}>複製物件</button>
          <button disabled={!hasSelection} onClick={onDelete}>刪除</button>
          <button disabled={!hasSelection} onClick={onSolid}>設為實體</button>
          <button disabled={!hasSelection} onClick={onHole}>設為挖洞</button>
          <button disabled={!hasSelection} onClick={onPlace}>貼齊平台</button>
          <button disabled={!hasSelection} onClick={onCenter}>置中</button>
          <button disabled={!hasSelection} onClick={onApply}>套用變形</button>
          <button disabled={!hasSelection} onClick={onFocus}>聚焦物件</button>
        </>
      ) : (
        <>
          <button onClick={() => onAddShape('cube')}>新增方塊</button>
          <button onClick={() => onAddShape('sphere')}>新增球體</button>
          <button onClick={() => onAddShape('cylinder')}>新增圓柱</button>
          <button disabled={!hasSelection} onClick={onCopy}>複製選取</button>
          <button disabled={!hasClipboard} onClick={onPaste}>貼上</button>
        </>
      )}
    </div>
  );
}
