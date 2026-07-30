import React from 'react';

// Иконка «Честный знак» — воспроизведена как вектор (жёлтый скруглённый
// квадрат, рамка сканера по углам и галочка). Чёткая на любом размере.
export default function ChzIcon({ size = 16, style }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: 'inline-block', verticalAlign: '-0.18em', ...style }}
      role="img"
      aria-label="Честный знак"
    >
      <rect x="3" y="3" width="94" height="94" rx="24" fill="#F3E500" stroke="#D9CE00" strokeWidth="2" />
      <g fill="none" stroke="#5A5A5A" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M24 38 L24 30 A6 6 0 0 1 30 24 L38 24" />
        <path d="M62 24 L70 24 A6 6 0 0 1 76 30 L76 38" />
        <path d="M24 62 L24 70 A6 6 0 0 1 30 76 L38 76" />
        <path d="M62 76 L70 76 A6 6 0 0 1 76 70 L76 62" />
      </g>
      <path d="M33 51 L45 63 L69 39" fill="none" stroke="#5A5A5A" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
