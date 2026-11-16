import { useNavigate } from 'react-router-dom'
import ArrowRightIcon from './icons/ArrowRightIcon'

type RoundNavigationButtonProps = {
  to: string
  label: string
  direction?: 'up' | 'down'
  className?: string
}

export default function RoundNavigationButton({ to, label, direction = 'up', className = 'fixed top-6' }: RoundNavigationButtonProps) {
  const navigate = useNavigate()
  const down = direction === 'down'
  const iconClass = `h-5 w-5 ${down ? 'rotate-90' : '-rotate-90'}`

  return (
    <button type="button" onClick={() => navigate(to)} aria-label={label} className={`group round-navigation ${className}`}>
      <span className={`transition-transform duration-300 ${down ? 'group-hover:translate-y-[300%]' : 'group-hover:-translate-y-[300%]'}`}>
        <ArrowRightIcon className={iconClass} />
      </span>
      <span className={`absolute transition-transform duration-300 group-hover:translate-y-0 ${down ? '-translate-y-[300%]' : 'translate-y-[300%]'}`}>
        <ArrowRightIcon className={iconClass} />
      </span>
    </button>
  )
}
