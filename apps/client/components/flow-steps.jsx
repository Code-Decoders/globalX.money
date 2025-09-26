"use client";

const steps = [
  { title: "Quote", description: "Lock rate" },
  { title: "Add funds", description: "Top up PYUSD" },
  { title: "Recipient", description: "Payee details" },
];

export function FlowSteps({ current }) {
  return (
    <ol className="flex items-center justify-between gap-2 text-xs">
      {steps.map((step, index) => {
        const stepNumber = index + 1;
        const isActive = stepNumber === current;
        const isCompleted = stepNumber < current;

        return (
          <li
            key={step.title}
            className="flex flex-1 items-center gap-3 rounded-[var(--radius-lg)] border border-border/60 bg-muted/60 px-3 py-2"
          >
            <span
              className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold ${
                isActive
                  ? "bg-primary text-primary-foreground"
                  : isCompleted
                  ? "bg-primary/20 text-primary"
                  : "bg-background text-muted-foreground"
              }`}
            >
              {stepNumber}
            </span>
            <div className="flex flex-col">
              <span className={`text-xs font-semibold ${isActive ? "text-foreground" : "text-muted-foreground"}`}>
                {step.title}
              </span>
              <span className="text-[10px] text-muted-foreground">{step.description}</span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
