// components/Logo.tsx — simple flat single-colour rabbit mark.
// One flat fill (currentColor); eyes are the only other colour (white dots).
export function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="currentColor"
      role="img"
      aria-label="Hopper"
    >
      {/* ears */}
      <ellipse cx="24" cy="15" rx="5.5" ry="16" transform="rotate(-9 24 15)" />
      <ellipse cx="40" cy="15" rx="5.5" ry="16" transform="rotate(9 40 15)" />
      {/* head */}
      <circle cx="32" cy="31" r="14" />
      {/* body */}
      <ellipse cx="32" cy="47.5" rx="17" ry="13.5" />
      {/* eyes */}
      <circle cx="27" cy="30" r="2.2" fill="#fff" />
      <circle cx="37" cy="30" r="2.2" fill="#fff" />
    </svg>
  )
}
