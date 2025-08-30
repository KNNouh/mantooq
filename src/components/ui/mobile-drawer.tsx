import * as React from "react"
import { useIsMobile } from "@/hooks/use-mobile"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { Drawer, DrawerContent, DrawerTrigger } from "@/components/ui/drawer"

interface MobileDrawerProps {
  children: React.ReactNode
  trigger: React.ReactNode
  side?: "top" | "bottom" | "left" | "right"
  className?: string
}

export function MobileDrawer({ 
  children, 
  trigger, 
  side = "left", 
  className 
}: MobileDrawerProps) {
  const isMobile = useIsMobile()

  if (isMobile) {
    return (
      <Drawer>
        <DrawerTrigger asChild>
          {trigger}
        </DrawerTrigger>
        <DrawerContent className={className}>
          {children}
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <Sheet>
      <SheetTrigger asChild>
        {trigger}
      </SheetTrigger>
      <SheetContent side={side} className={className}>
        {children}
      </SheetContent>
    </Sheet>
  )
}