// Dock Page — Floating mini-PWA panel: phone + SMS summary at a glance.
// Opens via "Open dock" button in the dialer's AudioSettings panel.

import Dock from '@/components/Portal/Dialer/Dock';

export const metadata = {
  title: 'NetRate Dock',
  // Override the root layout's manifest (/manifest.webmanifest, which points
  // at /portal/mlo) so the dock can be installed as its OWN PWA — separate
  // taskbar icon from the main MLO portal install.
  manifest: '/portal/dock/manifest.webmanifest',
  icons: {
    icon: [
      { url: '/icons/dock-icon.svg', type: 'image/svg+xml' },
    ],
  },
};

export default function DockPage() {
  return <Dock />;
}
