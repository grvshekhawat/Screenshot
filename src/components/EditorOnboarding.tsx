import { ONBOARDING_STEPS, type OnboardingStepId } from "../editor-onboarding"

type EditorOnboardingProps = {
  completed: Record<OnboardingStepId, boolean>
  onStepClick: (step: OnboardingStepId) => void
  onDismiss: () => void
}

export function EditorOnboarding({
  completed,
  onStepClick,
  onDismiss,
}: EditorOnboardingProps) {
  const doneCount = ONBOARDING_STEPS.filter((step) => completed[step.id]).length
  const allDone = doneCount === ONBOARDING_STEPS.length
  const next = ONBOARDING_STEPS.find((step) => !completed[step.id])

  // Parent hides when all done; this is only the in-progress card.
  if (allDone) return null

  return (
    <div className="pointer-events-auto absolute bottom-4 left-4 z-50 w-[min(100%-2rem,300px)] rounded-lg border border-white/10 bg-[#07070a]/95 p-3 shadow-xl shadow-black/40 backdrop-blur-sm">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-semibold text-zinc-100">
            Get your first export
          </p>
          <p className="mt-0.5 text-[11px] text-zinc-500">
            {doneCount} of {ONBOARDING_STEPS.length}
            {next ? ` · ${next.title}` : ""}
          </p>
        </div>
        <button
          type="button"
          onClick={(event) => {
            event.preventDefault()
            event.stopPropagation()
            onDismiss()
          }}
          className="shrink-0 rounded px-1.5 py-0.5 text-[11px] text-zinc-500 hover:bg-white/10 hover:text-zinc-200"
        >
          Skip
        </button>
      </div>

      <ol className="space-y-1">
        {ONBOARDING_STEPS.map((step, index) => {
          const done = completed[step.id]
          const isNext = next?.id === step.id
          return (
            <li key={step.id}>
              <button
                type="button"
                onClick={() => onStepClick(step.id)}
                className={`flex w-full items-start gap-2.5 rounded-lg px-2 py-2 text-left transition ${
                  isNext
                    ? "bg-[#e8ff47]/10 ring-1 ring-[#e8ff47]/40"
                    : done
                      ? "opacity-70 hover:bg-white/[0.04]"
                      : "hover:bg-white/[0.04]"
                }`}
              >
                <span
                  className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold ${
                    done
                      ? "bg-emerald-500/20 text-emerald-400"
                      : isNext
                        ? "bg-[#e8ff47] text-[#0a0a0c]"
                        : "bg-white/10 text-zinc-400"
                  }`}
                >
                  {done ? "✓" : index + 1}
                </span>
                <span className="min-w-0">
                  <span
                    className={`block text-xs font-medium ${
                      done ? "text-zinc-400 line-through" : "text-zinc-100"
                    }`}
                  >
                    {step.title}
                  </span>
                  <span className="mt-0.5 block text-[11px] leading-snug text-zinc-500">
                    {step.detail}
                  </span>
                </span>
              </button>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
