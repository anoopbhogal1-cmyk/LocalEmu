import { useId } from "react";
import { cn } from "@/utils/cn";

/**
 * LocalEmuLogo — faithful vector crest matching the LocalEmu neon arcade emblem:
 *   • PCB circuit traces radiating behind a cyan → hot-magenta neon ring
 *   • Retro grey cartridge at 12 o'clock with pixel-dissolve sparkles
 *   • Gold / coral / magenta orbital swoosh around italicized "LE"
 *   • Beveled retro controller (cross D-pad, start/select plate, 4 red buttons)
 *   • Bold beveled "LOCAL EMU" banner + cyan "RETRO GAME EMULATION HUB"
 */
export function LocalEmuLogo({
  size = 48,
  showCircuits = false,
  className,
}: {
  size?: number;
  showCircuits?: boolean;
  className?: string;
}) {
  const uid = useId().replace(/:/g, "");
  const ringGrad = `le-ring-${uid}`;
  const innerScan = `le-scan-${uid}`;
  const goldGrad = `le-gold-${uid}`;
  const leGrad = `le-monogram-${uid}`;
  const swooshGrad = `le-swoosh-${uid}`;
  const glowFilter = `le-glow-${uid}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox={showCircuits ? "0 0 260 260" : "24 22 212 216"}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="LocalEmu — Retro Game Emulation Hub"
      className={cn("shrink-0 select-none", className)}
    >
      <defs>
        <linearGradient id={ringGrad} x1="130" y1="28" x2="130" y2="232" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#72f8ff" />
          <stop offset="46%" stopColor="#35d9f6" />
          <stop offset="68%" stopColor="#ff3399" />
          <stop offset="100%" stopColor="#ff1e80" />
        </linearGradient>

        <linearGradient id={innerScan} x1="130" y1="38" x2="130" y2="215" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#3ce8ff" stopOpacity="0.65" />
          <stop offset="55%" stopColor="#1ca4cc" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#ff2e93" stopOpacity="0.55" />
        </linearGradient>

        <linearGradient id={goldGrad} x1="130" y1="154" x2="130" y2="188" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#fff8d8" />
          <stop offset="52%" stopColor="#f8cf7a" />
          <stop offset="100%" stopColor="#df9538" />
        </linearGradient>

        <linearGradient id={leGrad} x1="130" y1="78" x2="130" y2="108" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#fff3b8" />
          <stop offset="48%" stopColor="#ffae42" />
          <stop offset="100%" stopColor="#ff4d6d" />
        </linearGradient>

        <linearGradient id={swooshGrad} x1="72" y1="78" x2="190" y2="152" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#ffe17d" />
          <stop offset="48%" stopColor="#ff7b39" />
          <stop offset="100%" stopColor="#ff2994" />
        </linearGradient>

        <filter id={glowFilter} x="-18%" y="-18%" width="136%" height="136%">
          <feGaussianBlur stdDeviation="3.2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Optional outer PCB circuit traces */}
      {showCircuits ? (
        <g stroke="#29a7c9" strokeOpacity="0.32" strokeWidth="1.6" strokeLinecap="round">
          <path d="M36 86H14L6 78" />
          <circle cx="6" cy="78" r="2.5" fill="#4df3ff" fillOpacity="0.45" />
          <path d="M30 130H8" />
          <circle cx="8" cy="130" r="2.5" fill="#ff2e93" fillOpacity="0.45" />
          <path d="M40 174H18L10 184" />
          <circle cx="10" cy="184" r="2.5" fill="#ff2e93" fillOpacity="0.45" />
          <path d="M224 86H246L254 78" />
          <circle cx="254" cy="78" r="2.5" fill="#4df3ff" fillOpacity="0.45" />
          <path d="M230 130H252" />
          <circle cx="252" cy="130" r="2.5" fill="#4df3ff" fillOpacity="0.45" />
          <path d="M220 174H242L250 184" />
          <circle cx="250" cy="184" r="2.5" fill="#ff2e93" fillOpacity="0.45" />
          <path d="M88 30V12L80 5" />
          <path d="M172 30V12L180 5" />
          <path d="M92 228V246L82 254" stroke="#ff2e93" strokeOpacity="0.3" />
          <path d="M168 228V246L178 254" stroke="#ff2e93" strokeOpacity="0.3" />
        </g>
      ) : null}

      {/* Outer ambient halo + neon ring */}
      <circle cx="130" cy="128" r="96" fill="#130e24" />
      <circle
        cx="130"
        cy="128"
        r="95"
        stroke={`url(#${ringGrad})`}
        strokeWidth="5.5"
        filter={`url(#${glowFilter})`}
      />
      <circle
        cx="130"
        cy="128"
        r="86"
        stroke={`url(#${innerScan})`}
        strokeWidth="7"
        strokeDasharray="3 2.2"
      />
      <circle cx="130" cy="128" r="80" fill="#141026" stroke="#292347" strokeWidth="1.5" />

      {/* Top Retro Game Cartridge + Pixel Dissolve */}
      <g>
        {/* Pixel dissolve particles on top-left */}
        <rect x="92" y="45" width="4" height="4" fill="#4df3ff" />
        <rect x="98" y="40" width="3.5" height="3.5" fill="#72f8ff" />
        <rect x="87" y="52" width="3.5" height="3.5" fill="#35c9f7" />
        <rect x="95" y="53" width="4" height="4" fill="#4df3ff" />
        <rect x="83" y="60" width="3" height="3" fill="#ffd86b" />
        <rect x="91" y="61" width="3.5" height="3.5" fill="#4df3ff" />

        {/* Cartridge body */}
        <path
          d="M104 42H154V60H159V76H101V50L104 42Z"
          fill="#6f8299"
          stroke="#191528"
          strokeWidth="3"
          strokeLinejoin="round"
        />
        <rect x="106" y="45" width="45" height="27" rx="2" fill="#8ea3ba" />
        {/* Grip ridges on cartridge left */}
        <rect x="108" y="48" width="7" height="2.6" fill="#384759" />
        <rect x="108" y="53" width="7" height="2.6" fill="#384759" />
        <rect x="108" y="58" width="7" height="2.6" fill="#384759" />
        <rect x="108" y="63" width="7" height="2.6" fill="#384759" />
        {/* Cartridge art window */}
        <rect x="119" y="48" width="29" height="17" rx="1.5" fill="#253246" stroke="#dce8f5" strokeWidth="1.3" />
        <circle cx="138" cy="56" r="2" fill="#ff4d94" />
        <circle cx="142" cy="53" r="1.6" fill="#5ef2ff" />
        <circle cx="134" cy="59" r="1.5" fill="#ffd166" />
      </g>

      {/* Cosmic 4-point pixel stars */}
      <g>
        <path d="M74 86L76.5 91.5L82 94L76.5 96.5L74 102L71.5 96.5L66 94L71.5 91.5Z" fill="#ffd86b" />
        <path d="M189 102L191.5 107.5L197 110L191.5 112.5L189 118L186.5 112.5L181 110L186.5 107.5Z" fill="#ffd86b" />
        <path d="M68 124L69.6 127.4L73 129L69.6 130.6L68 134L66.4 130.6L63 129L66.4 127.4Z" fill="#ff4da6" />
        <path d="M175 138L176.6 141.4L180 143L176.6 144.6L175 148L173.4 144.6L170 143L173.4 141.4Z" fill="#4df3ff" />
        <rect x="184" y="84" width="3.5" height="3.5" fill="#4df3ff" />
        <rect x="193" y="128" width="3.5" height="3.5" fill="#4df3ff" />
        <rect x="78" y="138" width="3.5" height="3.5" fill="#ff4da6" />
        <circle cx="84" cy="108" r="2" fill="#ffe17d" />
        <circle cx="176" cy="76" r="2" fill="#ffe17d" />
      </g>

      {/* Swirling Gold / Coral / Pink Orbital Swoosh */}
      <path
        d="M84 114C78 90 105 69 142 71C172 73 186 89 175 106"
        stroke={`url(#${swooshGrad})`}
        strokeWidth="6.5"
        strokeLinecap="round"
      />
      <path
        d="M174 124C178 144 148 160 112 156C86 153 76 139 87 124"
        stroke={`url(#${swooshGrad})`}
        strokeWidth="5.5"
        strokeLinecap="round"
      />

      {/* Italicized "LE" Monogram */}
      <g>
        <text
          x="131"
          y="102"
          textAnchor="middle"
          fontFamily="'Chakra Petch', sans-serif"
          fontWeight="800"
          fontStyle="italic"
          fontSize="29"
          letterSpacing="-1"
          fill={`url(#${leGrad})`}
          stroke="#191126"
          strokeWidth="4.5"
          paintOrder="stroke"
        >
          LE
        </text>
      </g>

      {/* Center Classic Retro Controller */}
      <g>
        <rect
          x="87"
          y="106"
          width="86"
          height="42"
          rx="6.5"
          fill="#f6dfa4"
          stroke="#1a1228"
          strokeWidth="3.5"
        />
        <rect x="92" y="111" width="76" height="32" rx="3.5" fill="#2c2942" />
        {/* Center metallic stripes + Start/Select plate */}
        <rect x="120" y="113" width="20" height="5" rx="1" fill="#595673" />
        <rect x="120" y="120" width="20" height="5" rx="1" fill="#595673" />
        <rect x="119" y="128" width="22" height="11" rx="2" fill="#f3d999" />
        <rect x="122" y="132" width="6.5" height="3.2" rx="1" fill="#2c2942" />
        <rect x="131.5" y="132" width="6.5" height="3.2" rx="1" fill="#2c2942" />

        {/* Cross D-Pad */}
        <path
          d="M103 119H109V124H114V130H109V135H103V130H98V124H103V119Z"
          fill="#1b182b"
          stroke="#b9b5cc"
          strokeWidth="1.4"
          strokeLinejoin="round"
        />

        {/* 4 Crimson-Red Diamond Face Buttons */}
        <circle cx="154" cy="120" r="4.1" fill="#ff3b6b" stroke="#181326" strokeWidth="1.5" />
        <circle cx="147" cy="127" r="4.1" fill="#ff3b6b" stroke="#181326" strokeWidth="1.5" />
        <circle cx="161" cy="127" r="4.1" fill="#ff3b6b" stroke="#181326" strokeWidth="1.5" />
        <circle cx="154" cy="134" r="4.1" fill="#ff3b6b" stroke="#181326" strokeWidth="1.5" />
      </g>

      {/* Main Title Plate: LOCAL EMU */}
      <g>
        <rect
          x="42"
          y="153"
          width="176"
          height="34"
          rx="7"
          fill="#171026"
          stroke="#ff2e93"
          strokeWidth="2.2"
        />
        <text
          x="130"
          y="179"
          textAnchor="middle"
          fontFamily="'Chakra Petch', sans-serif"
          fontWeight="800"
          fontSize="27.5"
          letterSpacing="1.6"
          fill={`url(#${goldGrad})`}
          stroke="#120b1e"
          strokeWidth="4.5"
          paintOrder="stroke"
        >
          LOCAL EMU
        </text>
      </g>

      {/* Lower Neon Ribbon: RETRO GAME EMULATION HUB */}
      <g>
        <rect
          x="56"
          y="187"
          width="148"
          height="17"
          rx="5"
          fill="#140f24"
          stroke="#ff2e93"
          strokeWidth="2"
        />
        <text
          x="130"
          y="198.8"
          textAnchor="middle"
          fontFamily="'JetBrains Mono', monospace"
          fontWeight="700"
          fontSize="8.6"
          letterSpacing="0.8"
          fill="#62f4ff"
        >
          RETRO GAME EMULATION HUB
        </text>
      </g>
    </svg>
  );
}
