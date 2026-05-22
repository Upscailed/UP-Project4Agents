'use client';

import React from 'react';

/**
 * Strakke monochrome SVG iconen.
 * Allemaal 16×16 default, gebruiken `currentColor` zodat ze de tekstkleur volgen.
 *
 * Gebruik: <Icon name="status_in_progress" size={14} />
 */

export type IconName =
  // Status (ring/pie/check varianten)
  | 'status_triage'
  | 'status_backlog'
  | 'status_todo'
  | 'status_in_progress'
  | 'status_in_review'
  | 'status_done'
  | 'status_cancelled'
  // Priority (ascending bars)
  | 'priority_none'
  | 'priority_low'
  | 'priority_medium'
  | 'priority_high'
  | 'priority_urgent'
  // UI / nav
  | 'board'
  | 'cycles'
  | 'activity'
  | 'views'
  | 'projects'
  | 'plus'
  | 'close'
  | 'trash'
  | 'search'
  | 'check'
  | 'arrow_right'
  | 'copy'
  // Entities
  | 'user'
  | 'agent'
  | 'github'
  | 'branch'
  | 'pr'
  | 'comment'
  | 'link'
  | 'sub_issues'
  | 'calendar'
  | 'estimate';

export function Icon({
  name,
  size = 14,
  strokeWidth = 1.5,
  style,
}: {
  name: IconName;
  size?: number;
  strokeWidth?: number;
  style?: React.CSSProperties;
}) {
  const s = size;
  const sw = strokeWidth;
  const common = {
    width: s, height: s, viewBox: '0 0 16 16',
    fill: 'none', stroke: 'currentColor',
    strokeWidth: sw, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const,
    style: { display: 'inline-block', verticalAlign: '-2px', ...style },
  };

  switch (name) {
    // ── Status ────────────────────────────────────────────────
    case 'status_triage':
      // dashed circle met dot in midden
      return (
        <svg {...common}>
          <circle cx="8" cy="8" r="6" strokeDasharray="2 2" />
          <circle cx="8" cy="8" r="1.5" fill="currentColor" stroke="none" />
        </svg>
      );
    case 'status_backlog':
      // dashed ring
      return (
        <svg {...common}>
          <circle cx="8" cy="8" r="6" strokeDasharray="2 2" />
        </svg>
      );
    case 'status_todo':
      // empty thin circle
      return (
        <svg {...common}>
          <circle cx="8" cy="8" r="6" />
        </svg>
      );
    case 'status_in_progress':
      // 50% pie + ring
      return (
        <svg {...common}>
          <circle cx="8" cy="8" r="6" />
          <path d="M8 2 A6 6 0 0 1 8 14 Z" fill="currentColor" stroke="none" />
        </svg>
      );
    case 'status_in_review':
      // 75% pie + ring
      return (
        <svg {...common}>
          <circle cx="8" cy="8" r="6" />
          <path d="M8 2 A6 6 0 0 1 8 14 A6 6 0 0 1 2 8 Z" fill="currentColor" stroke="none" />
        </svg>
      );
    case 'status_done':
      // filled circle + check
      return (
        <svg {...common}>
          <circle cx="8" cy="8" r="6" fill="currentColor" stroke="none" />
          <path d="M5 8.5 L7 10.5 L11 6" stroke="white" strokeWidth="1.7" />
        </svg>
      );
    case 'status_cancelled':
      // circle met X
      return (
        <svg {...common}>
          <circle cx="8" cy="8" r="6" fill="currentColor" stroke="none" />
          <path d="M5.5 5.5 L10.5 10.5 M10.5 5.5 L5.5 10.5" stroke="white" strokeWidth="1.7" />
        </svg>
      );

    // ── Priority (3 ascending bars) ───────────────
    case 'priority_none':
      // drie kleine punten op midden
      return (
        <svg {...common}>
          <circle cx="4" cy="8" r="0.9" fill="currentColor" stroke="none" />
          <circle cx="8" cy="8" r="0.9" fill="currentColor" stroke="none" />
          <circle cx="12" cy="8" r="0.9" fill="currentColor" stroke="none" />
        </svg>
      );
    case 'priority_low':
      // 1 korte bar gevuld, 2 outline
      return (
        <svg {...common}>
          <rect x="2"  y="11" width="3" height="3" fill="currentColor" stroke="none" />
          <rect x="6.5" y="8" width="3" height="6" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.35" />
          <rect x="11" y="5" width="3" height="9" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.35" />
        </svg>
      );
    case 'priority_medium':
      // 2 bars gevuld, 1 outline
      return (
        <svg {...common}>
          <rect x="2"  y="11" width="3" height="3" fill="currentColor" stroke="none" />
          <rect x="6.5" y="8" width="3" height="6" fill="currentColor" stroke="none" />
          <rect x="11" y="5" width="3" height="9" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.35" />
        </svg>
      );
    case 'priority_high':
      // 3 bars gevuld
      return (
        <svg {...common}>
          <rect x="2"  y="11" width="3" height="3" fill="currentColor" stroke="none" />
          <rect x="6.5" y="8" width="3" height="6" fill="currentColor" stroke="none" />
          <rect x="11" y="5" width="3" height="9" fill="currentColor" stroke="none" />
        </svg>
      );
    case 'priority_urgent':
      // gevuld vierkant met uitroepteken
      return (
        <svg {...common}>
          <rect x="2" y="2" width="12" height="12" rx="2" fill="currentColor" stroke="none" />
          <rect x="7.25" y="4" width="1.5" height="6" fill="white" stroke="none" />
          <rect x="7.25" y="11" width="1.5" height="1.5" fill="white" stroke="none" />
        </svg>
      );

    // ── Nav / UI ───────────────────────────────────────────────
    case 'board':
      return (
        <svg {...common}>
          <rect x="2"  y="3" width="3" height="10" rx="0.5" />
          <rect x="6.5" y="3" width="3" height="6"  rx="0.5" />
          <rect x="11" y="3" width="3" height="8"  rx="0.5" />
        </svg>
      );
    case 'cycles':
      return (
        <svg {...common}>
          <path d="M13 4.5 A6 6 0 1 0 13.5 11" />
          <path d="M13 2 V5 H10" />
        </svg>
      );
    case 'activity':
      return (
        <svg {...common}>
          <path d="M1 8 H4 L6 3 L9 13 L11 8 H15" />
        </svg>
      );
    case 'views':
      return (
        <svg {...common}>
          <path d="M2 4 H14" />
          <path d="M4 8 H12" />
          <path d="M6 12 H10" />
        </svg>
      );
    case 'projects':
      return (
        <svg {...common}>
          <rect x="2" y="3" width="12" height="10" rx="1" />
          <path d="M2 6 H14" />
        </svg>
      );
    case 'plus':
      return (
        <svg {...common}>
          <path d="M8 3 V13 M3 8 H13" />
        </svg>
      );
    case 'close':
      return (
        <svg {...common}>
          <path d="M4 4 L12 12 M12 4 L4 12" />
        </svg>
      );
    case 'trash':
      return (
        <svg {...common}>
          <path d="M3 5 H13" />
          <path d="M5 5 V13 A1 1 0 0 0 6 14 H10 A1 1 0 0 0 11 13 V5" />
          <path d="M6 5 V3 A1 1 0 0 1 7 2 H9 A1 1 0 0 1 10 3 V5" />
        </svg>
      );
    case 'search':
      return (
        <svg {...common}>
          <circle cx="7" cy="7" r="4.5" />
          <path d="M10.5 10.5 L14 14" />
        </svg>
      );
    case 'check':
      return (
        <svg {...common}>
          <path d="M3 8.5 L6.5 12 L13 4" />
        </svg>
      );
    case 'arrow_right':
      return (
        <svg {...common}>
          <path d="M3 8 H13 M9 4 L13 8 L9 12" />
        </svg>
      );
    case 'copy':
      return (
        <svg {...common}>
          <rect x="5" y="5" width="9" height="9" rx="1" />
          <path d="M3 11 V3 A1 1 0 0 1 4 2 H11" />
        </svg>
      );

    // ── Entities ───────────────────────────────────────────────
    case 'user':
      return (
        <svg {...common}>
          <circle cx="8" cy="6" r="2.5" />
          <path d="M3 14 C3 11 5 9.5 8 9.5 C11 9.5 13 11 13 14" />
        </svg>
      );
    case 'agent':
      // bot — square head met antenna en oogjes
      return (
        <svg {...common}>
          <rect x="3" y="5" width="10" height="8" rx="1.5" />
          <path d="M8 5 V2.5" />
          <circle cx="8" cy="2" r="0.8" fill="currentColor" stroke="none" />
          <circle cx="6" cy="9" r="0.8" fill="currentColor" stroke="none" />
          <circle cx="10" cy="9" r="0.8" fill="currentColor" stroke="none" />
        </svg>
      );
    case 'github':
      // octocat-stijl gestripped: katje silhouet
      return (
        <svg {...common} viewBox="0 0 16 16" fill="currentColor" stroke="none">
          <path d="M8 1.5 C4.4 1.5 1.5 4.4 1.5 8 C1.5 10.9 3.4 13.3 6 14.2 C6.4 14.3 6.5 14 6.5 13.8 V12.6 C4.8 13 4.4 11.8 4.4 11.8 C4.1 11.1 3.7 10.9 3.7 10.9 C3.2 10.5 3.8 10.5 3.8 10.5 C4.3 10.6 4.6 11.1 4.6 11.1 C5.1 11.9 5.9 11.7 6.2 11.5 C6.3 11.1 6.4 10.9 6.6 10.7 C5.3 10.6 3.9 10 3.9 7.8 C3.9 7.1 4.1 6.6 4.5 6.2 C4.4 6 4.3 5.4 4.6 4.6 C4.6 4.6 5.1 4.5 6.4 5.3 C6.9 5.2 7.4 5.1 8 5.1 C8.6 5.1 9.1 5.2 9.6 5.3 C10.9 4.5 11.4 4.6 11.4 4.6 C11.7 5.4 11.6 6 11.5 6.2 C11.9 6.6 12.1 7.1 12.1 7.8 C12.1 10 10.7 10.6 9.4 10.7 C9.6 10.9 9.8 11.3 9.8 11.9 V13.8 C9.8 14 9.9 14.3 10.3 14.2 C12.9 13.3 14.5 10.9 14.5 8 C14.5 4.4 11.6 1.5 8 1.5 Z" />
        </svg>
      );
    case 'branch':
      return (
        <svg {...common}>
          <circle cx="4" cy="3.5" r="1.5" />
          <circle cx="4"  cy="12.5" r="1.5" />
          <circle cx="12" cy="6" r="1.5" />
          <path d="M4 5 V11" />
          <path d="M4 8 C4 6.5 5.5 6 7 6 H10.5" />
        </svg>
      );
    case 'pr':
      return (
        <svg {...common}>
          <circle cx="4" cy="3.5" r="1.5" />
          <circle cx="4" cy="12.5" r="1.5" />
          <circle cx="12" cy="12.5" r="1.5" />
          <path d="M4 5 V11" />
          <path d="M12 11 V7 C12 5.5 10.5 5 9 5 H7" />
          <path d="M9 3 L7 5 L9 7" />
        </svg>
      );
    case 'comment':
      return (
        <svg {...common}>
          <path d="M2 4 A1 1 0 0 1 3 3 H13 A1 1 0 0 1 14 4 V10 A1 1 0 0 1 13 11 H6 L3 14 V11 H3 A1 1 0 0 1 2 10 Z" />
        </svg>
      );
    case 'link':
      return (
        <svg {...common}>
          <path d="M7 10 L4.5 12.5 A2.5 2.5 0 0 1 1 9 L3.5 6.5" />
          <path d="M9 6 L11.5 3.5 A2.5 2.5 0 0 1 15 7 L12.5 9.5" />
          <path d="M6 10 L10 6" />
        </svg>
      );
    case 'sub_issues':
      return (
        <svg {...common}>
          <path d="M3 3 V11 A1 1 0 0 0 4 12 H8" />
          <path d="M6 10 L8 12 L6 14" />
          <rect x="9" y="2" width="5" height="3" rx="0.5" />
          <rect x="9" y="11" width="5" height="3" rx="0.5" />
        </svg>
      );
    case 'calendar':
      return (
        <svg {...common}>
          <rect x="2" y="3" width="12" height="11" rx="1" />
          <path d="M2 6 H14" />
          <path d="M5 1.5 V4 M11 1.5 V4" />
        </svg>
      );
    case 'estimate':
      // clock
      return (
        <svg {...common}>
          <circle cx="8" cy="8" r="6" />
          <path d="M8 5 V8 L10 9.5" />
        </svg>
      );
  }
}

/** Helper: render snel een Icon op een gegeven kleur. */
export function ColorIcon({ color, name, size }: { color: string; name: IconName; size?: number }) {
  return <span style={{ color }}><Icon name={name} size={size} /></span>;
}
