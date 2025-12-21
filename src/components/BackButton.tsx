import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import ArrowRightIcon from './icons/ArrowRightIcon'

type BackButtonProps = {
  to?: string
}

function BackButton({ to = '/home' }: BackButtonProps) {
  const navigate = useNavigate()

  const handleBack = useCallback(() => {
    navigate(to)
  }, [navigate, to])

  return (
    <button
      type="button"
      onClick={handleBack}
      className="group fixed left-1/2 top-6 z-30 -translate-x-1/2 inline-flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-neutral-950 font-medium text-neutral-200 active:scale-95 transition-transform"
    >
      <div className="transition-transform duration-300 group-hover:-translate-y-[300%]">
        <ArrowRightIcon className="h-5 w-5 -rotate-90" />
      </div>
      <div className="absolute translate-y-[300%] transition-transform duration-300 group-hover:translate-y-0">
        <ArrowRightIcon className="h-5 w-5 -rotate-90" />
      </div>
    </button>
  )
}

export default BackButton
