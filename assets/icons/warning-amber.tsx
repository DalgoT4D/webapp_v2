import * as React from 'react';

interface WarningAmberIconProps {
  className?: string;
  size?: number;
  color?: string;
}

const WarningAmberIcon = ({ className, size = 18, color = '#981F1F' }: WarningAmberIconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <path d="M12 5.99L19.53 19H4.47L12 5.99ZM12 2L1 21H23L12 2Z" fill={color} />
    <path d="M13 16H11V18H13V16Z" fill={color} />
    <path d="M13 10H11V15H13V10Z" fill={color} />
  </svg>
);

export default WarningAmberIcon;
