/**
 * Text-based logo for the template (no external image assets required).
 */
export default function SiteLogo({
  variant = 'primary',
  className = 'h-12 w-auto',
  alt = 'NODE TEMPLATE',
}) {
  const isWhite = variant === 'white';
  return (
    <span
      className={`inline-flex items-center font-bold tracking-tight ${className} ${
        isWhite ? 'text-white' : 'text-cyan-600'
      }`}
      aria-label={alt}
    >
      <span className={`rounded-lg px-2 py-0.5 text-xs sm:text-sm ${isWhite ? 'bg-cyan-600/20 text-cyan-300' : 'bg-cyan-50 text-cyan-700'}`}>
        NODE
      </span>
      <span className={`ml-1.5 text-sm sm:text-base ${isWhite ? 'text-white' : 'text-navy-900'}`}>
        TEMPLATE
      </span>
    </span>
  );
}
