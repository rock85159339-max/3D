import React from 'react';

export default function ToolGroup({ label, children }) {
  return (
    <section className="tool-group" aria-label={label}>
      {label && <span className="tool-group-label">{label}</span>}
      <div className="tool-group-buttons">{children}</div>
    </section>
  );
}
