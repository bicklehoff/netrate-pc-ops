// Dock Page — Floating mini-PWA panel: phone + SMS summary at a glance.
// Opens via "Open dock" button in the dialer's AudioSettings panel.

import Dock from '@/components/Portal/Dialer/Dock';

export const metadata = {
  title: 'NetRate Dock',
};

export default function DockPage() {
  return <Dock />;
}
