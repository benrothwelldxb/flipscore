import { useEffect } from 'react'
import {
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from 'framer-motion'

interface CountUpProps {
  value: number
  className?: string
  duration?: number
}

/** A number that smoothly tweens when its value changes. */
export function CountUp({ value, className, duration = 0.5 }: CountUpProps) {
  const reduce = useReducedMotion()
  const motionValue = useMotionValue(value)
  const rounded = useTransform(motionValue, (v) => Math.round(v).toString())

  useEffect(() => {
    if (reduce) {
      motionValue.set(value)
      return
    }
    const controls = animate(motionValue, value, { duration, ease: 'easeOut' })
    return () => controls.stop()
  }, [value, duration, motionValue, reduce])

  return (
    <motion.span className={className} aria-hidden>
      {rounded}
    </motion.span>
  )
}
