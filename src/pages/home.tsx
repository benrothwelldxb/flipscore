import { motion, type Variants } from 'framer-motion'
import { Sparkles, Users, Zap } from 'lucide-react'

import { Logo } from '@/components/brand/logo'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'

const container: Variants = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.08, delayChildren: 0.05 },
  },
}

const item: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { type: 'spring', bounce: 0.3 } },
}

const features = [
  {
    icon: Users,
    title: 'Any crew',
    description: '2 to 12 players, teams or solo.',
    tint: 'text-suit-heart',
  },
  {
    icon: Zap,
    title: 'Any game',
    description: 'Cards, dice, board games — you name it.',
    tint: 'text-suit-club',
  },
] as const

export function HomePage() {
  const { toast } = useToast()

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="flex flex-col items-center gap-8 py-8"
    >
      <motion.div variants={item} className="flex flex-col items-center gap-4">
        <motion.div
          initial={{ rotate: -8, scale: 0.9 }}
          animate={{ rotate: 0, scale: 1 }}
          transition={{ type: 'spring', bounce: 0.5, delay: 0.1 }}
        >
          <Logo className="size-20 drop-shadow-lg" decorative />
        </motion.div>
        <div className="space-y-2 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-balance">
            Keep score, not the receipts.
          </h1>
          <p className="text-muted-foreground text-sm text-balance">
            FlipScore is a fast, friendly scoreboard for game night.
          </p>
        </div>
      </motion.div>

      <motion.div variants={item} className="w-full">
        <Dialog>
          <DialogTrigger asChild>
            <Button size="lg" className="w-full">
              <Sparkles className="size-5" />
              Start a game
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>The scoreboard is on its way</DialogTitle>
              <DialogDescription>
                We&apos;re still shuffling the deck. Setting up a game and
                keeping score arrive in the next update — thanks for the early
                look!
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <DialogClose asChild>
                <Button
                  onClick={() =>
                    toast('See you at game night', {
                      description: "We'll let you know when scoring is ready.",
                    })
                  }
                >
                  Got it
                </Button>
              </DialogClose>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </motion.div>

      <motion.div variants={item} className="grid w-full grid-cols-2 gap-3">
        {features.map(({ icon: Icon, title, description, tint }) => (
          <Card key={title} className="gap-3 py-5">
            <CardHeader className="gap-2 px-4">
              <Icon className={`size-6 ${tint}`} aria-hidden />
              <CardTitle asChild className="text-base">
                <h2>{title}</h2>
              </CardTitle>
              <CardDescription>{description}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </motion.div>

      <motion.p
        variants={item}
        className="text-muted-foreground text-center text-xs"
      >
        Works offline · Installable · No account needed
      </motion.p>
    </motion.div>
  )
}
