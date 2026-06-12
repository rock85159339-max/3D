import React from 'react';

export default function IconButton({
  icon: Icon,
  label,
  active = false,
  disabled = false,
  danger = false,
  onClick,
  shortcut,
  tooltip,
  badge,
  className = '',
}) {
  const title = [tooltip || label, shortcut ? `快捷鍵：${shortcut}` : ''].filter(Boolean).join('\n');
  return (
    <button
      type="button"
      className={`icon-button ${active ? 'active' : ''} ${danger ? 'danger' : ''} ${className}`}
      disabled={disabled}
      onClick={disabled ? undefined : onClick}
      title={title}
      aria-label={label}
    >
      {Icon && <Icon size={18} strokeWidth={2.1} />}
      {badge && <span className="icon-button-badge">{badge}</span>}
      {shortcut && <span className="icon-button-shortcut">{shortcut}</span>}
    </button>
  );
}
