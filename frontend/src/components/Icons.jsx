import React from "react";

const svgProps = (props) => ({
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
  ...props,
});

export const PlayIcon = (props) => (
  <svg {...svgProps(props)}>
    <path d="M7 4.5v15l12-7.5z" fill="currentColor" stroke="none" />
  </svg>
);

export const PauseIcon = (props) => (
  <svg {...svgProps(props)}>
    <rect x="6" y="4.5" width="4" height="15" rx="1" fill="currentColor" stroke="none" />
    <rect x="14" y="4.5" width="4" height="15" rx="1" fill="currentColor" stroke="none" />
  </svg>
);

export const ResetIcon = (props) => (
  <svg {...svgProps(props)}>
    <path d="M3 12a9 9 0 1 0 3-6.7" />
    <path d="M3 4v5h5" />
  </svg>
);

export const StopwatchIcon = (props) => (
  <svg {...svgProps(props)}>
    <circle cx="12" cy="13" r="8" />
    <path d="M12 9v4l2.5 2" />
    <path d="M10 2h4" />
  </svg>
);

export const TagIcon = (props) => (
  <svg {...svgProps(props)}>
    <path d="M20.6 13.4l-7.2 7.2a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z" />
    <circle cx="7.5" cy="7.5" r="1.5" />
  </svg>
);

export const UserIcon = (props) => (
  <svg {...svgProps(props)}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21a8 8 0 0 1 16 0" />
  </svg>
);

export const MailIcon = (props) => (
  <svg {...svgProps(props)}>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="M3 7l9 6 9-6" />
  </svg>
);

export const XIcon = (props) => (
  <svg {...svgProps(props)}>
    <path d="M18 6L6 18M6 6l12 12" />
  </svg>
);

export const DownloadIcon = (props) => (
  <svg {...svgProps(props)}>
    <path d="M12 3v12" />
    <path d="M7 10l5 5 5-5" />
    <path d="M5 21h14" />
  </svg>
);
