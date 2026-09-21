/** A pair of scissors, drawn in the current text colour, for clipping stories. */
export default function ScissorsIcon({ className = "scissors" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" width="1em" height="1em" aria-hidden="true" focusable="false">
      <g fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <circle cx="6" cy="18" r="3" />
        <circle cx="18" cy="18" r="3" />
        <path d="M8.3 15.7 20 3M15.7 15.7 4 3" />
      </g>
    </svg>
  );
}
