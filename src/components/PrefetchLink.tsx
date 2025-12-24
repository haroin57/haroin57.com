import { Link, type LinkProps } from 'react-router-dom'

interface PrefetchLinkProps extends LinkProps {
  enablePrefetch?: boolean
}

function PrefetchLink(props: PrefetchLinkProps) {
  const { enablePrefetch, ...linkProps } = props
  void enablePrefetch
  return <Link {...linkProps} />
}

export default PrefetchLink
