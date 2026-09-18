"use client"

import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

export function TekaTag({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn("inline-flex items-center rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-primary", className)}>{children}</span>
}

export function TekaSectionTitle({ eyebrow, children, className }: { eyebrow?: string; children: ReactNode; className?: string }) {
  return <div className={cn("relative", className)}>{eyebrow && <p className="mb-3 text-xs font-bold uppercase tracking-[0.22em] text-primary">{eyebrow} <span aria-hidden="true">✳</span></p>}<h2 className="text-3xl font-black leading-none tracking-[-0.045em] sm:text-5xl">{children}</h2><div className="mt-5 h-1 w-20 bg-primary" /></div>
}

export function TekaDivider({ className }: { className?: string }) { return <div className={cn("flex items-center gap-3 text-primary", className)} aria-hidden="true"><span className="h-px flex-1 bg-primary/30" /><span className="text-lg">✳</span><span className="h-px flex-1 bg-primary/30" /></div> }

export function TekaEmptyState({ title, description, action }: { title: string; description: string; action?: ReactNode }) { return <div className="teka-paper flex flex-col items-center justify-center px-6 py-20 text-center"><span className="mb-5 text-4xl text-primary" aria-hidden="true">✳</span><h2 className="text-2xl font-black tracking-tight">{title}</h2><p className="mt-2 max-w-md text-muted-foreground">{description}</p>{action && <div className="mt-6">{action}</div>}</div> }
