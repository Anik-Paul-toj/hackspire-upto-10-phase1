// NAVIGATION
export const NAV_LINKS = [
  { href: '/', key: 'home', label: 'Home' },
  { href: '/status', key: 'status', label: 'Status' },
  { href: '/', key: 'how_guardio_work', label: 'How Guardio Works?' },
  { href: '/', key: 'features', label: 'Features' },
  { href: '/', key: 'safety_zones', label: 'Safety Zones' },
  { href: '/', key: 'contact_us', label: 'Contact Us' },
];

// CAMP SECTION
export const PEOPLE_URL = [
  '/person-1.png',
  '/person-2.png',
  '/person-3.png',
  '/person-4.png',
];

// FEATURES SECTION
export const FEATURES = [
  {
    title: 'Blockchain-based Digital Tourist ID',
    icon: '/map.svg',
    variant: 'green',
    description:
      'Tamper-proof digital verification with biometric data and QR profile for trusted identity verification and secure access to tourist services.',
  },
  {
    title: 'IoT-driven Geo-Fencing & SOS Alerts',
    icon: '/calendar.svg',
    variant: 'green',
    description:
      'Smart sensors detect hazards and trigger instant alerts to tourists. Set virtual boundaries for safety zones with automated emergency responses.',
  },
  {
    title: 'Offline Emergency Mesh using WebRTC',
    icon: '/tech.svg',
    variant: 'green',
    description:
      'P2P communication network that functions during network blackouts. Maintain critical connectivity when traditional emergency systems fail.',
  },
  {
    title: 'Real-time Location & Safety Ledger',
    icon: '/location.svg',
    variant: 'orange',
    description:
      'Continuous tracking with immutable safety records for accountability. Coordinate emergency response with precise location data and incident history.',
  },
];

// FOOTER SECTION
export const FOOTER_LINKS = [
  {
    title: 'Learn More',
    links: [
      'About Guardio',
      'Safety Technology',
      'Privacy & Security',
      'Emergency Response',
      'Privacy Policy',
      'Contact Us',
    ],
  },
  {
    title: 'Safety Community',
    links: ['Tourist Safety Network', 'Emergency Responders', 'Guardio Partners'],
  },
];

export const FOOTER_CONTACT_INFO = {
  title: 'Emergency Contact',
  links: [
    { label: 'Emergency Hotline', value: '911-GUARDIO' },
    { label: 'Support Email', value: 'help@guardio.safety' },
  ],
};

export const SOCIALS = {
  title: 'Social',
  links: [
    '/facebook.svg',
    '/instagram.svg',
    '/twitter.svg',
    '/youtube.svg',
    '/wordpress.svg',
  ],
};
