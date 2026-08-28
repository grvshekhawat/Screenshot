type PaywallModalProps = {
  open: boolean
  onClose: () => void
  onChoose: (provider: "stripe" | "paypal") => void
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl">
        <h2 className="text-lg font-semibold text-white">Unlock clean exports</h2>
        <p className="mt-2 text-sm leading-relaxed text-zinc-400">
          Free includes watermarked PNG previews. Subscribe for clean PNGs, ZIP
          packs, and all store sizes (iPhone, iPad, Play) from one design.
        </p>
        {error ? <p className="mt-3 text-sm text-red-400">{error}</p> : null}
        <div className="mt-5 flex flex-col gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => onChoose("stripe")}
            className="rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-50"
          >
            {busy ? "Starting…" : "Pay with card (Stripe)"}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => onChoose("paypal")}
            className="rounded-lg bg-[#0070ba] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#005ea6] disabled:opacity-50"
          >
            {busy ? "Starting…" : "Pay with PayPal"}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm text-zinc-400 hover:text-white"
          >
            Not now
          </button>
        </div>
      </div>
    </div>
  )
}
