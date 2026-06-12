import React from 'react';

function formatScale(value) {
  if (value == null || Number.isNaN(Number(value))) return '-';
  return Number(value).toFixed(2).replace(/\.00$/, '').replace(/(\.\d)0$/, '$1');
}

function formatSize(value) {
  if (value == null || Number.isNaN(Number(value))) return '-';
  return Number(value).toFixed(1).replace(/\.0$/, '');
}

export default function ScaleFeedbackOverlay({ feedback }) {
  if (!feedback?.visible) return null;

  return (
    <div className={`scale-feedback-overlay ${feedback.isDragging ? 'dragging' : 'settling'}`}>
      <strong>縮放中</strong>
      {feedback.objectName && <span className="scale-feedback-name">{feedback.objectName}</span>}
      <div className="scale-feedback-grid">
        {['x', 'y', 'z'].map((axis) => (
          <React.Fragment key={axis}>
            <span>{axis.toUpperCase()}</span>
            <span>{formatScale(feedback.scale?.[axis])}×</span>
            <span>{formatSize(feedback.size?.[axis])} mm</span>
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}
