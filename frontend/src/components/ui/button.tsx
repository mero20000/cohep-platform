import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-lg text-sm font-medium transition-all duration-100 ease-out-strong active:scale-[0.97] btn-press-scale focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-gold-500 text-gray-950 hover:bg-gold-600 focus-visible:ring-gold-500",
        destructive: "bg-critical-500 text-white hover:bg-critical-600 focus-visible:ring-critical-500",
        outline: "border border-gray-200 bg-white hover:bg-gray-50 active:bg-gray-100 focus-visible:ring-gray-400",
        secondary: "bg-burgundy-500 text-white hover:bg-burgundy-600 focus-visible:ring-burgundy-500",
        ghost: "hover:bg-gray-100 focus-visible:ring-gray-400",
        link: "text-gold-700 underline-offset-4 hover:underline focus-visible:ring-gold-500",
        gold: "bg-gradient-to-r from-gold-500 to-gold-600 text-gray-950 hover:from-gold-600 hover:to-gold-700 focus-visible:ring-gold-500",
        success: "bg-success-500 text-white hover:bg-success-600 focus-visible:ring-success-500",
        warning: "bg-warning-500 text-gray-950 hover:bg-warning-600 focus-visible:ring-warning-500",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-lg px-3",
        lg: "h-11 rounded-lg px-8",
        xl: "h-12 rounded-lg px-8 text-base",
        icon: "h-10 w-10",
        "icon-sm": "h-8 w-8",
        "icon-lg": "h-12 w-12",
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

// React 19: ref is a regular prop — no forwardRef needed
function Button({ className, variant, size, asChild = false, ref, ...props }: ButtonProps & { ref?: React.Ref<HTMLButtonElement> }) {
  const Comp = asChild ? Slot : "button"
  return (
    <Comp
      className={cn(buttonVariants({ variant, size, className }))}
      ref={ref}
      {...props}
    />
  )
}

export { Button, buttonVariants }
