import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/interfaces-tooltip"

export default function TooltipBottomDemo() {
  return (
    <div className="flex items-center justify-center w-full min-h-screen bg-background p-8 overflow-hidden">
      <Tooltip>
        <TooltipTrigger asChild>
          <button className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium shadow-sm hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
            Hover
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          Add to library
        </TooltipContent>
      </Tooltip>
    </div>
  )
}
