import React from 'react';

export default function InspectorRow({ label, value, children }) {
  return (
    <div className="inspector-row">
      <span>{label}</span>
      <strong>{children ?? value}</strong>
    </div>
  );
}
