import React from 'react';
import { motion } from 'motion/react';

interface FinDreamLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'full' | 'icon-only';
  animated?: boolean;
}

export const FinDreamLogo: React.FC<FinDreamLogoProps> = ({
  className = '',
  size = 'md',
  variant = 'full',
  animated = true
}) => {
  // Dimensions based on size preset
  const dims = {
    sm: { svg: 'w-10 h-10', text: 'text-lg', sub: 'text-[6px] tracking-widest' },
    md: { svg: 'w-24 h-20', text: 'text-2xl', sub: 'text-[8px] tracking-widest' },
    lg: { svg: 'w-48 h-36', text: 'text-4xl', sub: 'text-[11px] tracking-[0.2em]' },
    xl: { svg: 'w-80 h-60', text: 'text-5xl', sub: 'text-[12.5px] tracking-[0.24em]' }
  }[size];

  const Wrapper = animated ? motion.g : 'g';

  return (
    <div className={`flex flex-col items-center justify-center ${className} select-none`}>
      {/* SVG Image containing the beautiful brand logo */}
      <svg
        viewBox="0 0 240 180"
        className={`${dims.svg} overflow-visible`}
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* Brand Green-Gradient */}
          <linearGradient id="fd-brand-green" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#25B0BA" />
            <stop offset="100%" stopColor="#125F6E" />
          </linearGradient>
          
          {/* Gold Outline Gradient for compass and loupe */}
          <linearGradient id="fd-gold-gradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#FDE047" />
            <stop offset="60%" stopColor="#CA8A04" />
            <stop offset="100%" stopColor="#854D0E" />
          </linearGradient>

          {/* Golden Loupe Fill with Glare */}
          <linearGradient id="fd-loupe-glass" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#FEF08A" stopOpacity="0.8" />
            <stop offset="40%" stopColor="#FDE047" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#EAB308" stopOpacity="0.9" />
          </linearGradient>

          {/* Soft Shadow Filter for ultra-polished look */}
          <filter id="fd-soft-shadow" x="-10%" y="-10%" width="120%" height="120%">
            <feDropShadow dx="1" dy="4" stdDeviation="5" floodColor="#0F172A" floodOpacity="0.12" />
          </filter>
        </defs>

        {/* --- BACKDROP GLOW (Only shows on SVG render) --- */}
        <circle cx="120" cy="110" r="70" fill="#25B0BA" fillOpacity="0.04" filter="blur(20px)" />

        {/* --- SPARKLES / STAR DECORATIONS --- */}
        {/* Sparkle Left */}
        <Wrapper
          initial={animated ? { scale: 0, opacity: 0 } : undefined}
          animate={animated ? { scale: [0, 1.2, 1], opacity: [0, 1, 0.85] } : undefined}
          transition={{ delay: 0.8, duration: 0.8, repeat: Infinity, repeatType: 'reverse', repeatDelay: 3 }}
        >
          <polygon
            points="45,85 48,88 51,85 48,82"
            fill="#25B0BA"
            className="origin-center"
          />
          <polygon
            points="38,105 42,109 46,105 42,101"
            fill="#1E6877"
            className="origin-center"
          />
        </Wrapper>

        {/* Sparkle Top-Right */}
        <Wrapper
          initial={animated ? { scale: 0, opacity: 0 } : undefined}
          animate={animated ? { scale: [0, 1.1, 1], opacity: [0, 1, 0.9] } : undefined}
          transition={{ delay: 1.1, duration: 0.7 }}
        >
          <polygon
            points="145,55 148,59 151,55 148,51"
            fill="#25B0BA"
          />
        </Wrapper>

        {/* Sparkle right near Compass B */}
        <Wrapper
          initial={animated ? { scale: 0, opacity: 0 } : undefined}
          animate={animated ? { scale: [0, 1.3, 1], opacity: 1 } : undefined}
          transition={{ delay: 1.3, duration: 0.6 }}
        >
          <polygon
            points="218,125 220,128 222,125 220,122"
            fill="#25B0BA"
          />
        </Wrapper>


        {/* --- THE CLOUD SHAPE --- */}
        {/* Detailed 4-loop cartoon-like cloud mimicking the reference photo */}
        <motion.path
          d="M172 102 C178 72, 142 62, 118 66 C100 52, 72 61, 68 78 C42 76, 28 98, 38 122 C26 142, 50 162, 75 156 L165 156 C190 158, 202 138, 192 122 C198 114, 190 102, 172 102 Z"
          fill="#FFFFFF"
          stroke="#1E6877"
          strokeWidth="9"
          strokeLinecap="round"
          strokeLinejoin="round"
          filter="url(#fd-soft-shadow)"
          initial={animated ? { pathLength: 0, opacity: 0 } : undefined}
          animate={animated ? { pathLength: 1, opacity: 1 } : undefined}
          transition={{ duration: 1.4, ease: "easeInOut" }}
        />

        {/* --- THE LOOPING ASCENDING ARROW --- */}
        {/* Curated loop arrow forming financial track & sweeping out to the top right */}
        <g id="fd-loop-arrow">
          {/* Arrow ribbon/path with looping effect centered under Euro symbol */}
          <motion.path
            d="M 68 142 C 55 125, 85 98, 116 102 C 142 105, 148 135, 122 144 C 95 152, 72 130, 96 112 C 115 98, 142 84, 168 81"
            fill="none"
            stroke="#1E6877"
            strokeWidth="9"
            strokeLinecap="round"
            initial={animated ? { pathLength: 0 } : undefined}
            animate={animated ? { pathLength: 1 } : undefined}
            transition={{ delay: 0.3, duration: 1.2, ease: "easeInOut" }}
          />
          
          <motion.path
            d="M 68 142 C 55 125, 85 98, 116 102 C 142 105, 148 135, 122 144 C 95 152, 72 130, 96 112 C 115 98, 142 84, 168 81"
            fill="none"
            stroke="#25B0BA"
            strokeWidth="5"
            strokeLinecap="round"
            initial={animated ? { pathLength: 0 } : undefined}
            animate={animated ? { pathLength: 1 } : undefined}
            transition={{ delay: 0.4, duration: 1.2, ease: "easeInOut" }}
          />

          {/* Sweeping arrow continuation & pointer breakout */}
          <motion.path
            d="M 166 81 L 194 65"
            fill="none"
            stroke="#25B0BA"
            strokeWidth="7"
            strokeLinecap="round"
            initial={animated ? { pathLength: 0 } : undefined}
            animate={animated ? { pathLength: 1 } : undefined}
            transition={{ delay: 1.0, duration: 0.4 }}
          />

          {/* Solid bold Arrowhead breaking out */}
          <motion.path
            d="M 180 61 L 198 63 L 192 81 Z"
            fill="#25B0BA"
            stroke="#1E6877"
            strokeWidth="2.5"
            strokeLinejoin="round"
            initial={animated ? { scale: 0, opacity: 0 } : undefined}
            animate={animated ? { scale: 1, opacity: 1 } : undefined}
            transition={{ delay: 1.3, duration: 0.3, type: 'spring' }}
            className="origin-center"
            style={{ transformOrigin: '194px 65px' }}
          />
        </g>


        {/* --- EURO CURRENCY SYMBOL (€) --- */}
        {/* Beautiful serif-like bold Euro currency symbol nestled in loop center */}
        <motion.text
          x="100"
          y="132"
          fontFamily="Comfortaa, Inter, system-ui, sans-serif"
          fontWeight="900"
          fontSize="35"
          fill="#1E6877"
          initial={animated ? { scale: 0, opacity: 0, rotate: -25 } : undefined}
          animate={animated ? { scale: 1, opacity: 1, rotate: 0 } : undefined}
          transition={{ delay: 0.7, duration: 0.6, type: "spring" }}
          className="origin-center"
          style={{ transformOrigin: '112px 120px' }}
        >
          €
        </motion.text>


        {/* --- HAND AND GOLD LOUPE (MAGNIFYING GLASS) --- */}
        {/* Hand reaching from cloud border holding loupe */}
        <g id="fd-hand-loupe">
          {/* Hand vector stylized */}
          <motion.path
            d="M148 136 C144 136, 140 139, 142 142 C143 145, 146 146, 150 144 C154 142, 156 146, 153 149 C150 152, 152 155, 155 154 L164 147"
            fill="#FBCFE8" /* Pinkish flesh tone matching standard hand */
            stroke="#1E6877"
            strokeWidth="2.5"
            strokeLinecap="round"
            initial={animated ? { x: 5, y: 5, opacity: 0 } : undefined}
            animate={animated ? { x: 0, y: 0, opacity: 1 } : undefined}
            transition={{ delay: 0.8, duration: 0.5 }}
          />

          {/* Looking Glass / Loupe Handle */}
          <motion.line
            x1="162"
            y1="148"
            x2="175"
            y2="140"
            stroke="#854D0E"
            strokeWidth="5"
            strokeLinecap="round"
            initial={animated ? { opacity: 0 } : undefined}
            animate={animated ? { opacity: 1 } : undefined}
            transition={{ delay: 0.9 }}
          />
          <motion.line
            x1="162"
            y1="148"
            x2="175"
            y2="140"
            stroke="#FDE047"
            strokeWidth="2"
            strokeLinecap="round"
            initial={animated ? { opacity: 0 } : undefined}
            animate={animated ? { opacity: 1 } : undefined}
            transition={{ delay: 1.0 }}
          />

          {/* Loupe golden circle outer boundary */}
          <motion.circle
            cx="188"
            cy="133"
            r="16"
            fill="url(#fd-loupe-glass)"
            stroke="url(#fd-gold-gradient)"
            strokeWidth="4"
            filter="url(#fd-soft-shadow)"
            initial={animated ? { scale: 0, opacity: 0 } : undefined}
            animate={animated ? { scale: 1, opacity: 1 } : undefined}
            transition={{ delay: 0.9, duration: 0.6, type: "spring" }}
          />
          
          {/* Innermost ring highlighting for shine */}
          <motion.circle
            cx="188"
            cy="133"
            r="11"
            fill="none"
            stroke="#FFFFFF"
            strokeWidth="1.2"
            strokeDasharray="40 10"
            opacity="0.75"
            initial={animated ? { rotate: -45 } : undefined}
            animate={animated ? { rotate: 315 } : undefined}
            transition={{ delay: 1.2, duration: 1.2 }}
          />
        </g>


        {/* --- TWO GOLD COMPASSES --- */}
        {/* COMPASS A (Higher - Small) */}
        <g id="fd-compass-a">
          {/* Compass ring */}
          <motion.circle
            cx="192"
            cy="52"
            r="12"
            fill="#FFFFFF"
            stroke="url(#fd-gold-gradient)"
            strokeWidth="3.2"
            filter="url(#fd-soft-shadow)"
            initial={animated ? { scale: 0, opacity: 0 } : undefined}
            animate={animated ? { scale: 1, opacity: 1 } : undefined}
            transition={{ delay: 1.1, duration: 0.5, type: "spring" }}
          />
          {/* Inner ring marker details */}
          <circle cx="192" cy="52" r="8" fill="none" stroke="#CA8A04" strokeWidth="0.8" opacity="0.5" />
          
          {/* Directional needle pointing dynamic */}
          <motion.path
            d="M 192 45 L 195 52 L 192 59 L 189 52 Z"
            fill="#1E6877"
            initial={animated ? { rotate: -90 } : undefined}
            animate={animated ? { rotate: 25 } : undefined}
            transition={{ delay: 1.4, duration: 0.8, type: "spring" }}
            className="origin-center"
            style={{ transformOrigin: '192px 52px' }}
          />
          <motion.path
            d="M 192 45 L 195 52 L 192 52 Z"
            fill="#25B0BA"
            initial={animated ? { rotate: -90 } : undefined}
            animate={animated ? { rotate: 25 } : undefined}
            transition={{ delay: 1.4, duration: 0.8, type: "spring" }}
            className="origin-center"
            style={{ transformOrigin: '192px 52px' }}
          />
        </g>

        {/* COMPASS B (Lower - Bigger with Directions) */}
        <g id="fd-compass-b">
          {/* Compass circle */}
          <motion.circle
            cx="182"
            cy="92"
            r="18"
            fill="#FFFFFF"
            stroke="url(#fd-gold-gradient)"
            strokeWidth="4"
            filter="url(#fd-soft-shadow)"
            initial={animated ? { scale: 0, opacity: 0 } : undefined}
            animate={animated ? { scale: 1, opacity: 1 } : undefined}
            transition={{ delay: 1.2, duration: 0.6, type: "spring" }}
          />
          
          {/* Cardinal markers */}
          <text x="182" y="81" fontSize="5" fontWeight="900" textAnchor="middle" fill="#854D0E" fontFamily="sans-serif">N</text>
          <text x="182" y="106" fontSize="5" fontWeight="900" textAnchor="middle" fill="#854D0E" fontFamily="sans-serif">S</text>
          <text x="169" y="94" fontSize="5" fontWeight="900" textAnchor="middle" fill="#854D0E" fontFamily="sans-serif">W</text>
          <text x="194" y="94" fontSize="5" fontWeight="900" textAnchor="middle" fill="#854D0E" fontFamily="sans-serif">E</text>

          {/* Double-colored sleek needle */}
          <motion.path
            d="M 182 80 L 186 92 L 182 104 L 178 92 Z"
            fill="#1E6877"
            initial={animated ? { rotate: 45 } : undefined}
            animate={animated ? { rotate: -125 } : undefined}
            transition={{ delay: 1.6, duration: 1.2, type: "spring" }}
            className="origin-center"
            style={{ transformOrigin: '182px 92px' }}
          />
          <motion.path
            d="M 182 80 L 186 92 L 182 92 Z"
            fill="#25B0BA"
            initial={animated ? { rotate: 45 } : undefined}
            animate={animated ? { rotate: -125 } : undefined}
            transition={{ delay: 1.6, duration: 1.2, type: "spring" }}
            className="origin-center"
            style={{ transformOrigin: '182px 92px' }}
          />
          
          {/* Center needle pin */}
          <circle cx="182" cy="92" r="2" fill="#FDE047" stroke="#854D0E" strokeWidth="0.8" />
        </g>
      </svg>

      {/* --- BRAND TYPOGRAPHY BLOCK --- */}
      {variant === 'full' && (
        <div className="text-center mt-3.5 space-y-1">
          <motion.h1
            className={`${dims.text} font-black tracking-tight`}
            style={{ fontFamily: 'Outfit, Comfortaa, Inter, sans-serif' }}
            initial={animated ? { opacity: 0, y: 8 } : undefined}
            animate={animated ? { opacity: 1, y: 0 } : undefined}
            transition={{ delay: 0.4, duration: 0.6 }}
          >
            <span className="text-[#1B5256]">Fin</span>
            <span className="text-[#00BCB1]">Dream</span>
          </motion.h1>

          <motion.p
            className={`${dims.sub} font-extrabold text-[#1B5256]/85 uppercase mt-1.5`}
            style={{ fontFamily: 'Outfit, Inter, sans-serif' }}
            initial={animated ? { opacity: 0 } : undefined}
            animate={animated ? { opacity: 0.95 } : undefined}
            transition={{ delay: 0.7, duration: 0.6 }}
          >
            FINANZAS PARA TUS SUEÑOS
          </motion.p>
        </div>
      )}
    </div>
  );
};
