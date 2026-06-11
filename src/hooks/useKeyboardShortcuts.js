import { useEffect, useRef } from 'react';

function isTypingTarget(target) {
  const tagName = target?.tagName?.toLowerCase();
  return tagName === 'input' || tagName === 'textarea' || tagName === 'select' || target?.isContentEditable;
}

export default function useKeyboardShortcuts(handlers) {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    const onKeyDown = (event) => {
      const {
        activeWorkflowRef,
        modeRef,
        prefsRef,
        selectedIdsRef,
        undo,
        redo,
        setMode,
        switchWorkflow,
        setSculptSettings,
        roundNumber,
        setAxisLock,
        setBoxSelectActive,
        setContextMenu,
        attachTransformForSelection,
        focusSelectedObject,
        frameAllObjects,
        duplicateSelected,
        toggleProjection,
        setCameraView,
        deleteSelectedWithConfirm,
        showToast,
      } = handlersRef.current;
      const typing = isTypingTarget(event.target);
      const key = event.key.toLowerCase();

      if (event.ctrlKey && key === 'z') {
        event.preventDefault();
        undo();
      } else if (event.ctrlKey && key === 'y') {
        event.preventDefault();
        redo();
      } else if (!typing && key === 'w') {
        setMode('translate');
      } else if (!typing && key === 'g') {
        setMode('translate');
      } else if (!typing && key === 'e') {
        setMode('rotate');
      } else if (!typing && key === 'r') {
        setMode('rotate');
      } else if (!typing && key === 's') {
        setMode('scale');
      } else if (!typing && event.key === 'Delete') {
        deleteSelectedWithConfirm();
      } else if (!typing && key === 'x') {
        if (selectedIdsRef.current.length && ['translate', 'rotate', 'scale'].includes(modeRef.current)) setAxisLock('x');
      } else if (!typing && key === 'y') {
        if (selectedIdsRef.current.length && ['translate', 'rotate', 'scale'].includes(modeRef.current)) setAxisLock('y');
      } else if (!typing && key === 'z') {
        if (selectedIdsRef.current.length && ['translate', 'rotate', 'scale'].includes(modeRef.current)) setAxisLock('z');
      } else if (!typing && event.key === '1') {
        switchWorkflow('model');
      } else if (!typing && event.key === '2') {
        switchWorkflow('face');
      } else if (!typing && event.key === '3') {
        switchWorkflow('sculpt');
      } else if (!typing && event.key === '4') {
        switchWorkflow('prep');
      } else if (!typing && event.key === '5') {
        switchWorkflow('export');
      } else if (!typing && event.key === '[') {
        setSculptSettings((settings) => ({ ...settings, radius: Math.max(1, Number(settings.radius) - 1) }));
      } else if (!typing && event.key === ']') {
        setSculptSettings((settings) => ({ ...settings, radius: Math.min(200, Number(settings.radius) + 1) }));
      } else if (!typing && event.key === '-') {
        setSculptSettings((settings) => ({ ...settings, strength: Math.max(0, roundNumber(Number(settings.strength) - 0.05, 2)) }));
      } else if (!typing && event.key === '=') {
        setSculptSettings((settings) => ({ ...settings, strength: Math.min(1, roundNumber(Number(settings.strength) + 0.05, 2)) }));
      } else if (!typing && event.key === 'Tab') {
        event.preventDefault();
        if (event.ctrlKey) switchWorkflow('sculpt');
        else switchWorkflow(activeWorkflowRef.current === 'face' ? 'model' : 'face');
      } else if (!typing && event.key === 'Escape') {
        setAxisLock(null);
        setBoxSelectActive(false);
        setContextMenu(null);
        attachTransformForSelection([]);
      } else if (!typing && key === 'f') {
        focusSelectedObject();
      } else if (!typing && event.key === 'Home') {
        frameAllObjects();
      } else if (!typing && key === 'a' && prefsRef.current?.operationStyle === 'maya') {
        frameAllObjects();
      } else if (!typing && key === 'b') {
        setBoxSelectActive(true);
        showToast('框選模式：拖曳矩形選取物件，Esc 退出');
      } else if (!typing && event.shiftKey && key === 'd') {
        duplicateSelected();
      } else if (!typing && event.code === 'Numpad1') {
        setCameraView('front');
      } else if (!typing && event.code === 'Numpad3') {
        setCameraView('right');
      } else if (!typing && event.code === 'Numpad7') {
        setCameraView('top');
      } else if (!typing && event.code === 'Numpad5') {
        toggleProjection();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
}
