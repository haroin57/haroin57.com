import RoundNavigationButton from './RoundNavigationButton'

type BackButtonProps = {
  to?: string
}

function BackButton({ to = '/home' }: BackButtonProps) {
  return <RoundNavigationButton to={to} label={to === '/' ? 'トップページへ戻る' : 'ホームへ戻る'} />
}

export default BackButton
