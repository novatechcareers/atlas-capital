'use client';

const supportLinks = [
  { href: 'https://t.me/ATLASCAPITALco', label: 'Telegram', icon: 'telegram' },
  { href: 'https://wa.me/14065646451?s=t', label: 'WhatsApp', icon: 'whatsapp' },
] as const;

function SupportIcon({ type }: { type: 'telegram' | 'whatsapp' }) {
  const commonProps = {
    viewBox: '0 0 24 24',
    fill: 'currentColor',
    className: 'h-4 w-4',
    'aria-hidden': true,
  };

  if (type === 'telegram') {
    return (
      <svg {...commonProps}>
        <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2Zm4.89 6.6-1.64 7.71a1.1 1.1 0 0 1-1.74.58l-2.9-2.12-1.39 1.33a.79.79 0 0 1-.63.27l.22-3.18 5.67-5.11c.25-.22-.05-.34-.36-.12l-7 4.42-3-.94c-.69-.22-.7-.69.14-.98l12.4-4.78c.58-.22 1.08.13.89.9Z" />
      </svg>
    );
  }

  return (
    <svg {...commonProps}>
      <path d="M12.04 2C6.57 2 2.15 6.42 2.15 11.9c0 1.96.58 3.88 1.58 5.52L2 22l4.86-1.57A9.8 9.8 0 0 0 12.04 22c5.47 0 9.9-4.42 9.9-9.9S17.51 2 12.04 2Zm5.8 13.49c-.2.56-1.17 1.03-1.61 1.1-.42.07-.96.1-3.1-.67-2.62-1.13-4.34-3.95-4.47-4.15-.14-.2-1.15-1.53-1.15-2.9 0-1.37.72-2.06 1-2.35.2-.18.45-.22.59-.22h.42c.14 0 .34-.05.54.42.2.49.68 1.68.74 1.81.06.13.1.29.03.47-.07.18-.13.27-.27.42l-.34.41c-.1.1-.2.21-.09.4.11.2.49.82 1.07 1.33.74.66 1.36.86 1.56.96.2.1.32.08.44-.05.12-.13.53-.61.68-.82.14-.2.29-.17.49-.1.2.07 1.28.6 1.5.71.22.11.37.17.43.27.06.1.06.6-.14 1.16Z" />
    </svg>
  );
}

export function CustomerCareButton() {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {supportLinks.map((link) => (
        <a
          key={link.label}
          href={link.href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={link.label}
          className="inline-flex items-center gap-2 rounded-full border border-[color:var(--primary-gold)]/60 bg-transparent px-3 py-2 text-sm font-semibold text-[color:var(--primary-gold)] transition hover:bg-[color:var(--primary-gold)]/10"
        >
          <span className="inline-flex h-4 w-4 items-center justify-center text-[color:var(--primary-gold)]">
            <SupportIcon type={link.icon} />
          </span>
          <span>{link.label}</span>
        </a>
      ))}
    </div>
  );
}
