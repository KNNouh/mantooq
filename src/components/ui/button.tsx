import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md font-medium transition-all duration-200 focus-visible:outline-none disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: [
          "bg-primary text-primary-foreground shadow-sm",
          "hover:bg-primary-hover hover:shadow-md",
          "active:bg-primary-active active:scale-[0.98]",
          "disabled:bg-muted disabled:text-muted-foreground disabled:opacity-50",
          "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        ],
        destructive: [
          "bg-destructive text-destructive-foreground shadow-sm",
          "hover:bg-destructive-hover hover:shadow-md",
          "active:scale-[0.98]",
          "disabled:bg-muted disabled:text-muted-foreground disabled:opacity-50",
          "focus-visible:ring-2 focus-visible:ring-destructive focus-visible:ring-offset-2"
        ],
        outline: [
          "border border-input bg-background shadow-sm",
          "hover:bg-accent hover:text-accent-foreground hover:shadow-md",
          "active:scale-[0.98]",
          "disabled:border-muted disabled:text-muted-foreground disabled:opacity-50",
          "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        ],
        secondary: [
          "bg-secondary text-secondary-foreground shadow-sm",
          "hover:bg-secondary-hover hover:shadow-md",
          "active:scale-[0.98]",
          "disabled:bg-muted disabled:text-muted-foreground disabled:opacity-50",
          "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        ],
        ghost: [
          "hover:bg-accent hover:text-accent-foreground",
          "active:scale-[0.98]",
          "disabled:text-muted-foreground disabled:opacity-50",
          "focus-visible:ring-2 focus-visible:ring-ring"
        ],
        link: [
          "text-primary underline-offset-4",
          "hover:underline hover:text-primary-hover",
          "disabled:text-muted-foreground disabled:no-underline disabled:opacity-50",
          "focus-visible:ring-2 focus-visible:ring-ring focus-visible:rounded-sm"
        ],
      },
      size: {
        default: "h-10 px-4 py-2 text-sm min-h-[44px] [&_svg]:size-4",
        sm: "h-9 px-3 text-sm min-h-[36px] [&_svg]:size-4",
        lg: "h-12 px-8 text-lg min-h-[48px] [&_svg]:size-5",
        icon: "h-10 w-10 min-h-[44px] min-w-[44px] [&_svg]:size-4",
        "icon-sm": "h-9 w-9 min-h-[36px] min-w-[36px] [&_svg]:size-4",
        "icon-lg": "h-12 w-12 min-h-[48px] min-w-[48px] [&_svg]:size-5",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
