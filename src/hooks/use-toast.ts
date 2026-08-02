import { toast } from 'sonner'

/**
 * App-level toast access. Re-exported through a stable hook so feature code
 * never imports the toast implementation (sonner) directly.
 */
export function useToast() {
  return { toast }
}

export { toast }
