"use client"

import * as TooltipPrimitive from "@radix-ui/react-tooltip"

import { cn } from "../../lib/utils"

function TooltipProvider({
  delayDuration = 0,
  ...props
}) {
  return (
    <TooltipPrimitive.Provider
      data-slot="tooltip-provider"
      delayDuration={delayDuration}
      {...props}
    />
  )
}

function Tooltip({
  delayDuration = 150,
  ...props
}) {
  return (
    <TooltipPrimitive.Root delayDuration={delayDuration} data-slot="tooltip" {...props} />
  )
}

function TooltipTrigger({
  ...props
}) {
  return <TooltipPrimitive.Trigger data-slot="tooltip-trigger" {...props} />
}

function TooltipContent({
  className,
  sideOffset = 0,
  children,
  ...props
}) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        data-slot="tooltip-content"
        sideOffset={sideOffset}
        className={cn(
          "bg-foreground text-background z-50 w-fit origin-[var(--radix-tooltip-content-transform-origin)] rounded-md px-4 py-2 text-sm font-normal text-balance",
          className
        )}
        {...props}
      >
        {children}
        <TooltipPrimitive.Arrow className="bg-foreground fill-foreground z-50 size-2.5 translate-y-[calc(-50%-2px)] rotate-45 rounded-[2px]" />
      </TooltipPrimitive.Content>
    </TooltipPrimitive.Portal>
  )
}

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider }
