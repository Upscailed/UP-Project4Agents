import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'UP/Project4Agents',
  description: 'Project management for AI agents — Kanban board met API & MCP integratie',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="nl">
      <body>{children}</body>
    </html>
  );
}
