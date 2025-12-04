import { Link } from 'react-router-dom'

function Products() {
  return (
    <div className="relative overflow-hidden">
      <div className="pointer-events-none fixed inset-0 -z-10 flex items-center justify-center">
        <img
          src="/profile.png"
          alt="haroin profile"
          className="select-none"
          style={{ width: '100vw', height: '100vh', objectFit: 'cover', opacity: 'var(--overlay)' }}
        />
      </div>

      <main
        className="relative mx-auto min-h-screen max-w-4xl px-6 py-12 space-y-6 page-fade"
        style={{ fontFamily: '"bc-barell","Space Grotesk",system-ui,-apple-system,sans-serif', color: 'var(--fg)' }}
      >
        <header className="flex items-center gap-4 text-lg font-semibold" style={{ fontFamily: '"bc-barell","Space Grotesk",system-ui,-apple-system,sans-serif' }}>
          <Link to="/" className="underline-thin hover:text-accent" style={{ color: 'var(--fg)' }}>
            Home
          </Link>
        </header>

        <section className="space-y-4">
          <h1 className="text-2xl sm:text-3xl font-ab-countryroad font-medium leading-tight text-[color:var(--fg-strong)]">
            Products
          </h1>
          <p className="font-morisawa-dragothic text-base opacity-85">
            鋭意執筆中！
          </p>
        </section>
      </main>
    </div>
  )
}

export default Products
