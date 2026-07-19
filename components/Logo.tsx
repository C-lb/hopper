// components/Logo.tsx — cute side-view (profile) rabbit mark.
// Single flat fill (currentColor, used where currentColor is white); the eye is
// a small dark cutout. Facing right, one ear up, rounded body, little tail.
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
      {/* tail */}
      <circle cx="12" cy="40" r="5.5" />
      {/* body */}
      <ellipse cx="30" cy="42" rx="19" ry="14.5" />
      {/* haunch / front foot */}
      <ellipse cx="41" cy="53" rx="9" ry="4.5" />
      {/* head */}
      <circle cx="45" cy="29" r="11" />
      {/* snout */}
      <circle cx="54" cy="31" r="4.2" />
      {/* ear, laid up-and-back */}
      <ellipse cx="43" cy="13" rx="4.6" ry="12.5" transform="rotate(11 43 13)" />
      {/* eye — dark cutout */}
      <circle cx="47" cy="26" r="1.9" fill="#000" />
    </svg>
  )
}
