import React from 'react';

export default function InspectorCard({ title, actions, children, className = '' }) {
  return (
    <section className={`inspector-card polished-inspector-card ${className}`}>
      <header className="inspector-card-header">
        <strong>{title}</strong>
        {actions && <div className="inspector-card-actions">{actions}</div>}
      </header>
      <div className="inspector-card-body">{children}</div>
    </section>
  );
}
