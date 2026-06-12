import React from 'react';

const options = [
  { key: 'wireframe', label: '顯示線框' },
  { key: 'vertices', label: '顯示頂點' },
  { key: 'faceNormals', label: '顯示面法線' },
  { key: 'boundingBox', label: '顯示包圍盒' },
  { key: 'dimensions', label: '顯示尺寸標註' },
];

export default function ViewAssistPanel({ settings, onChange, onStub }) {
  return (
    <section className="printer-card">
      <div className="card-title">檢視輔助</div>
      <div className="view-assist-list">
        {options.map((option) => {
          const isStub = option.key === 'faceNormals' || option.key === 'dimensions';
          return (
            <label key={option.key} className="mini-check toggle-line">
              <input
                type="checkbox"
                checked={!!settings[option.key]}
                onChange={(event) => {
                  if (isStub && event.target.checked) onStub(`${option.label}下一版開放`);
                  onChange(option.key, event.target.checked);
                }}
              />
              <span>{option.label}</span>
            </label>
          );
        })}
      </div>
    </section>
  );
}
