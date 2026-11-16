const languageColors: Record<string, string> = {
  TypeScript: '#3178c6',
  JavaScript: '#f7df1e',
  Python: '#3572A5',
  Java: '#b07219',
  Go: '#00ADD8',
  Rust: '#dea584',
}

export default function LanguageBadge({ language, large = false }: { language: string; large?: boolean }) {
  return (
    <span className={`flex items-center ${large ? 'gap-1.5 text-sm sm:text-base' : 'gap-2 text-xs sm:text-sm text-[color:var(--fg,inherit)] opacity-75'}`}>
      <span aria-hidden="true" className={`h-3 w-3 rounded-full ${large ? 'sm:h-4 sm:w-4' : ''}`} style={{ backgroundColor: languageColors[language] || '#6e7681' }} />
      {language}
    </span>
  )
}
