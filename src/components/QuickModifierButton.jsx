import React from 'react';
import IconButton from './IconButton.jsx';

export default function QuickModifierButton({
  icon,
  label,
  tooltip,
  disabled = false,
  active = false,
  danger = false,
  badge,
  onClick,
}) {
  return (
    <IconButton
      icon={icon}
      label={label}
      tooltip={tooltip || label}
      disabled={disabled}
      active={active}
      danger={danger}
      badge={badge}
      onClick={onClick}
      className="quick-modifier-button"
    />
  );
}
