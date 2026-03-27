// MLO Header Bar — Company branding + logged-in user info
// Shows at top of MLO portal. Full width across nav + content + dialer.

'use client';

import { useSession } from 'next-auth/react';
import Image from 'next/image';

const MLO_PHOTOS = {
  'Jamie Cunningham': '/images/team/jamie-cunningham.jpg',
  'David Burson': '/images/team/david-burson.jpg',
};

function UserAvatar({ name, size = 32 }) {
  const photo = MLO_PHOTOS[name];
  const initials = (name || 'U')
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  if (photo) {
    return (
      <Image
        src={photo}
        alt={name}
        width={size}
        height={size}
        className="rounded-full object-cover"
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <div
      className="rounded-full bg-brand text-white flex items-center justify-center text-xs font-semibold"
      style={{ width: size, height: size }}
    >
      {initials}
    </div>
  );
}

export default function MloHeader() {
  const { data: session } = useSession();
  const userName = session?.user?.name || 'MLO';
  const userEmail = session?.user?.email || '';

  return (
    <div className="h-12 bg-white border-b border-gray-200 flex items-center justify-between px-4 flex-shrink-0">
      {/* Left: Company branding */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-0.5">
          <span className="text-lg font-bold text-gray-900">Net</span>
          <span className="text-lg font-bold text-brand">Rate</span>
          <span className="text-sm font-normal text-gray-400 ml-1">Mortgage</span>
        </div>
        <span className="text-gray-300">|</span>
        <span className="text-xs text-gray-400">NMLS #1111861</span>
        <span className="text-xs text-gray-400 hidden md:inline">· 303-444-5251</span>
      </div>

      {/* Right: Logged-in user */}
      <div className="flex items-center gap-3">
        <div className="text-right hidden sm:block">
          <div className="text-sm font-medium text-gray-700">{userName}</div>
          <div className="text-[10px] text-gray-400">{userEmail}</div>
        </div>
        <UserAvatar name={userName} size={32} />
      </div>
    </div>
  );
}
