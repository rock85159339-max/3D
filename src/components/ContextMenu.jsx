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
          <button disabled={!hasSelection} onClick={onCopy}>Copy</button>
          <button disabled={!hasSelection} onClick={onDuplicate}>Duplicate</button>
          <button disabled={!hasSelection} onClick={onDelete}>Delete</button>
          <button disabled={!hasSelection} onClick={onSolid}>Set Solid</button>
          <button disabled={!hasSelection} onClick={onHole}>Set Hole</button>
          <button disabled={!hasSelection} onClick={onPlace}>Place on Bed</button>
          <button disabled={!hasSelection} onClick={onCenter}>Center</button>
          <button disabled={!hasSelection} onClick={onApply}>Apply Transform</button>
          <button disabled={!hasSelection} onClick={onFocus}>Focus Object</button>
        </>
      ) : (
        <>
          <button onClick={() => onAddShape('cube')}>Add Cube</button>
          <button onClick={() => onAddShape('sphere')}>Add Sphere</button>
          <button onClick={() => onAddShape('cylinder')}>Add Cylinder</button>
          <button disabled={!hasSelection} onClick={onCopy}>Copy Selection</button>
          <button disabled={!hasClipboard} onClick={onPaste}>Paste</button>
        </>
      )}
    </div>
  );
}
