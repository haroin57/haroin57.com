import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react'

export function BecsButton({ className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type="button" className={`habit-control ${className}`} {...props} />
}
export function BecsInput({ label, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return <label className="grid gap-1 text-sm"><span>{label}</span><input className="ui-field w-full rounded px-3 py-2 min-h-12" {...props} /></label>
}
export function BecsSection({ title, children }: { title: string; children: ReactNode }) {
  return <section className="content-section"><h2 className="section-heading">{title}</h2>{children}</section>
}
