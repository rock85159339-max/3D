import React from 'react';

export default function LeftPanel({ children }) {
  return <aside className="left-panel" aria-label="左側工具列">{children}</aside>;
}
