import { Toaster as Sonner, type ToasterProps } from 'sonner'

import { useResolvedTheme } from '@/stores/theme-store'

function Toaster(props: ToasterProps) {
  const theme = useResolvedTheme()

  return (
    <Sonner
      theme={theme}
      position="top-center"
      richColors
      closeButton
      offset="calc(env(safe-area-inset-top) + 0.75rem)"
      toastOptions={{
        classNames: {
          toast: 'rounded-xl border-border shadow-lg',
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
