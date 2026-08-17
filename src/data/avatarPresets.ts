// Koleksi Avatar Preset Ringan (Lightweight Vector SVG Data URIs)
// Tanpa memuat link eksternal yang berat, langsung render instan dan 100% offline-ready.

export interface AvatarPreset {
  id: string;
  name: string;
  category: 'Spesialis Logistik' | 'Role & Jabatan' | 'Karakter & Warna';
  url: string;
  badgeColor: string;
}

const createSvgAvatar = (bgGradient: [string, string], iconSvg: string): string => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
    <defs>
      <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${bgGradient[0]}"/>
        <stop offset="100%" stop-color="${bgGradient[1]}"/>
      </linearGradient>
    </defs>
    <rect width="100" height="100" rx="28" fill="url(#g)"/>
    <g transform="translate(14, 14)">
      ${iconSvg}
    </g>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
};

export const AVATAR_PRESETS: AvatarPreset[] = [
  // 1. ROLE & JABATAN
  {
    id: 'avatar-super-admin',
    name: 'Super Administrator',
    category: 'Role & Jabatan',
    badgeColor: 'bg-red-500',
    url: createSvgAvatar(
      ['#DC2626', '#991B1B'],
      `<circle cx="36" cy="24" r="14" fill="#FFFFFF"/>
       <path d="M12 62 C12 46 22 42 36 42 C50 42 60 46 60 62" fill="#FFFFFF" opacity="0.95"/>
       <path d="M26 14 L36 6 L46 14 L42 20 L30 20 Z" fill="#FDE047" stroke="#CA8A04" stroke-width="2"/>
       <circle cx="36" cy="12" r="2.5" fill="#DC2626"/>`
    )
  },
  {
    id: 'avatar-head-warehouse',
    name: 'Kepala Gudang / Supervisor',
    category: 'Role & Jabatan',
    badgeColor: 'bg-blue-600',
    url: createSvgAvatar(
      ['#1E3A8A', '#1E40AF'],
      `<circle cx="36" cy="26" r="14" fill="#FFFFFF"/>
       <path d="M12 62 C12 46 22 42 36 42 C50 42 60 46 60 62" fill="#FFFFFF" opacity="0.95"/>
       <path d="M20 18 C20 10 26 8 36 8 C46 8 52 10 52 18 L20 18 Z" fill="#F59E0B"/>
       <rect x="18" y="17" width="36" height="4" rx="2" fill="#D97706"/>`
    )
  },
  {
    id: 'avatar-qc-inspector',
    name: 'Inspector QC / Quality',
    category: 'Role & Jabatan',
    badgeColor: 'bg-emerald-600',
    url: createSvgAvatar(
      ['#059669', '#047857'],
      `<circle cx="36" cy="26" r="14" fill="#FFFFFF"/>
       <path d="M12 62 C12 46 22 42 36 42 C50 42 60 46 60 62" fill="#FFFFFF" opacity="0.95"/>
       <circle cx="48" cy="48" r="12" fill="#F8FAFC" stroke="#059669" stroke-width="3"/>
       <path d="M43 48 L46 51 L53 44" stroke="#059669" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`
    )
  },
  {
    id: 'avatar-tally-man',
    name: 'Tally Inbound & Checker',
    category: 'Role & Jabatan',
    badgeColor: 'bg-amber-600',
    url: createSvgAvatar(
      ['#D97706', '#B45309'],
      `<circle cx="36" cy="26" r="14" fill="#FFFFFF"/>
       <path d="M12 62 C12 46 22 42 36 42 C50 42 60 46 60 62" fill="#FFFFFF" opacity="0.95"/>
       <rect x="24" y="44" width="24" height="20" rx="3" fill="#F8FAFC" stroke="#92400E" stroke-width="2"/>
       <line x1="28" y1="49" x2="44" y2="49" stroke="#D97706" stroke-width="2" stroke-linecap="round"/>
       <line x1="28" y1="54" x2="40" y2="54" stroke="#D97706" stroke-width="2" stroke-linecap="round"/>
       <line x1="28" y1="59" x2="36" y2="59" stroke="#D97706" stroke-width="2" stroke-linecap="round"/>`
    )
  },
  {
    id: 'avatar-operator-forklift',
    name: 'Operator Logistik & Forklift',
    category: 'Role & Jabatan',
    badgeColor: 'bg-orange-600',
    url: createSvgAvatar(
      ['#EA580C', '#C2410C'],
      `<circle cx="36" cy="24" r="14" fill="#FFFFFF"/>
       <path d="M12 62 C12 46 22 42 36 42 C50 42 60 46 60 62" fill="#FFFFFF" opacity="0.95"/>
       <path d="M22 14 C24 8 48 8 50 14 L22 14 Z" fill="#FBBF24"/>
       <path d="M20 14 L52 14 L54 18 L18 18 Z" fill="#F59E0B"/>
       <rect x="28" y="44" width="16" height="14" rx="2" fill="#FEF08A" stroke="#B45309" stroke-width="2"/>`
    )
  },

  // 2. SPESIALIS LOGISTIK
  {
    id: 'avatar-female-lead',
    name: 'Admin Logistik Wanita',
    category: 'Spesialis Logistik',
    badgeColor: 'bg-purple-600',
    url: createSvgAvatar(
      ['#7C3AED', '#5B21B6'],
      `<circle cx="36" cy="24" r="13" fill="#FED7AA"/>
       <path d="M23 20 C23 10 49 10 49 20 C49 24 50 30 52 34 C46 36 26 36 20 34 C22 30 23 24 23 20 Z" fill="#4C1D95"/>
       <path d="M14 62 C14 46 24 42 36 42 C48 42 58 46 58 62" fill="#F5D0FE"/>
       <circle cx="36" cy="25" r="11" fill="#FFEDD5"/>
       <path d="M25 18 C28 14 44 14 47 18 C47 22 47 20 49 24 C44 23 28 23 23 24 C25 20 25 22 25 18 Z" fill="#4C1D95"/>`
    )
  },
  {
    id: 'avatar-inventory-planner',
    name: 'Data Analyst & Inventory',
    category: 'Spesialis Logistik',
    badgeColor: 'bg-indigo-600',
    url: createSvgAvatar(
      ['#4F46E5', '#3730A3'],
      `<circle cx="36" cy="24" r="14" fill="#FFFFFF"/>
       <path d="M12 62 C12 46 22 42 36 42 C50 42 60 46 60 62" fill="#FFFFFF" opacity="0.95"/>
       <rect x="22" y="44" width="28" height="18" rx="3" fill="#E0E7FF" stroke="#3730A3" stroke-width="2"/>
       <rect x="26" y="48" width="6" height="10" fill="#4F46E5"/>
       <rect x="34" y="52" width="6" height="6" fill="#6366F1"/>
       <rect x="42" y="46" width="4" height="12" fill="#818CF8"/>`
    )
  },
  {
    id: 'avatar-safety-officer',
    name: 'HSE & Safety Officer',
    category: 'Spesialis Logistik',
    badgeColor: 'bg-teal-600',
    url: createSvgAvatar(
      ['#0D9488', '#115E59'],
      `<circle cx="36" cy="26" r="14" fill="#FFFFFF"/>
       <path d="M12 62 C12 46 22 42 36 42 C50 42 60 46 60 62" fill="#FFFFFF" opacity="0.95"/>
       <path d="M22 14 C24 8 48 8 50 14 L22 14 Z" fill="#2DD4BF"/>
       <circle cx="36" cy="50" r="10" fill="#CCFBF1" stroke="#0F766E" stroke-width="2"/>
       <path d="M36 44 L36 56 M30 50 L42 50" stroke="#0F766E" stroke-width="2.5" stroke-linecap="round"/>`
    )
  },

  // 3. KARAKTER & WARNA
  {
    id: 'avatar-modern-sapphire',
    name: 'Profil Sapphire Modern',
    category: 'Karakter & Warna',
    badgeColor: 'bg-sky-600',
    url: createSvgAvatar(
      ['#0284C7', '#0369A1'],
      `<circle cx="36" cy="24" r="14" fill="#E0F2FE"/>
       <path d="M12 62 C12 46 22 42 36 42 C50 42 60 46 60 62" fill="#BAE6FD"/>
       <circle cx="36" cy="24" r="7" fill="#0284C7"/>`
    )
  },
  {
    id: 'avatar-modern-amber',
    name: 'Profil Emas Warm',
    category: 'Karakter & Warna',
    badgeColor: 'bg-yellow-600',
    url: createSvgAvatar(
      ['#CA8A04', '#A16207'],
      `<circle cx="36" cy="24" r="14" fill="#FEF9C3"/>
       <path d="M12 62 C12 46 22 42 36 42 C50 42 60 46 60 62" fill="#FEF08A"/>
       <polygon points="36,17 40,26 49,27 42,33 44,42 36,37 28,42 30,33 23,27 32,26" fill="#CA8A04"/>`
    )
  },
  {
    id: 'avatar-modern-rose',
    name: 'Profil Crimson Rose',
    category: 'Karakter & Warna',
    badgeColor: 'bg-rose-600',
    url: createSvgAvatar(
      ['#E11D48', '#BE123C'],
      `<circle cx="36" cy="24" r="14" fill="#FFE4E6"/>
       <path d="M12 62 C12 46 22 42 36 42 C50 42 60 46 60 62" fill="#FECDD3"/>
       <path d="M36 21 C36 21 30 15 26 19 C22 23 25 30 36 37 C47 30 50 23 46 19 C42 15 36 21 36 21 Z" fill="#E11D48"/>`
    )
  },
  {
    id: 'avatar-modern-emerald',
    name: 'Profil Emerald Fresh',
    category: 'Karakter & Warna',
    badgeColor: 'bg-green-600',
    url: createSvgAvatar(
      ['#16A34A', '#15803D'],
      `<circle cx="36" cy="24" r="14" fill="#DCFCE7"/>
       <path d="M12 62 C12 46 22 42 36 42 C50 42 60 46 60 62" fill="#BBF7D0"/>
       <circle cx="36" cy="24" r="8" fill="#16A34A"/>
       <path d="M32 24 L35 27 L41 21" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`
    )
  }
];

export const DEFAULT_AVATAR = AVATAR_PRESETS[0].url;
