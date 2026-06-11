import React from 'react';

export function StatusRow({ label, ok, goodText, badText }) {
  return <div className={`status-row ${ok ? 'ok' : 'bad'}`}><span>{label}</span><strong>{ok ? goodText : badText}</strong></div>;
}

export default function PrintCheckPanel({ children }) {
  return <section className="print-check">{children}</section>;
}
