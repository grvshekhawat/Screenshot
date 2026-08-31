type PaywallModalProps = {
  open: boolean
  onClose: () => void
  onChoose: (provider: "stripe") => void
  busy?: boolean
  error?: string | null
}

export function PaywallModal({
  open,
  onClose,
  onChoose,
  busy,
  error,
}: PaywallModalProps) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-lg border border-white/[0.1] bg-[#0a0a0e] p-6 shadow-[0_32px_80px_-24px_rgba(0,0,0,0.9)]">
        <h2
          className="text-lg font-semibold tracking-tight text-white"
          style={{
            fontFamily: '"Outfit", ui-sans-serif, system-ui, sans-serif',
          }}
        >
          Unlock clean exports
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-zinc-400">
          Free includes watermarked PNG previews. Pro is{" "}
          <span className="font-medium text-zinc-200">$1.99/month</span> for
          clean PNGs, ZIP packs, and all store sizes (iPhone, iPad, Play) from
          one design.
        </p>
        {error ? <p className="mt-3 text-sm text-red-400">{error}</p> : null}
        <div className="mt-5 flex flex-col gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => onChoose("stripe")}
            className="rounded-md bg-[#e8ff47] px-4 py-2.5 text-sm font-semibold text-[#0a0a0c] transition hover:bg-[#f0ff7a] disabled:opacity-50"
          >
            {busy ? "Starting…" : "Subscribe with Stripe — $1.99/mo"}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className="rounded-md px-4 py-2 text-sm text-zinc-500 transition hover:text-white"
          >
            Not now
          </button>
        </div>
      </div>
    </div>
  )
}
