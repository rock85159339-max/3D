import React from 'react';

export default function InspectorBadge({ children, tone = 'neutral' }) {
  return <span className={`inspector-badge ${tone}`}>{children}</span>;
}
