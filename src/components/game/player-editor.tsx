import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type UniqueIdentifier,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { generateAvatar } from '@/avatar'
import { PLAYER_LIMITS, type AvatarConfig, type Player } from '@/domain/types'
import { cn } from '@/lib/utils'

import { AvatarCustomizer } from './avatar-customizer'
import { PlayerAvatar } from './player-avatar'

interface PlayerEditorProps {
  players: Player[]
  onRename: (playerId: string, name: string) => void
  onAvatarChange: (playerId: string, avatar: AvatarConfig) => void
  onRemove: (playerId: string) => void
  onReorder: (orderedIds: string[]) => void
}

interface RowProps {
  player: Player
  canRemove: boolean
  onRename: (playerId: string, name: string) => void
  onAvatarChange: (playerId: string, avatar: AvatarConfig) => void
  onRemove: (playerId: string) => void
}

function SortablePlayerRow({
  player,
  canRemove,
  onRename,
  onAvatarChange,
  onRemove,
}: RowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: player.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={cn(
        'bg-card flex items-center gap-1.5 rounded-xl border p-2',
        isDragging && 'z-10 shadow-lg',
      )}
    >
      <button
        type="button"
        className="text-muted-foreground flex size-11 shrink-0 touch-none items-center justify-center rounded-md"
        aria-label={`Reorder ${player.name}`}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-5" />
      </button>

      <Dialog>
        <DialogTrigger asChild>
          <button
            type="button"
            aria-label={`Customise ${player.name}'s avatar`}
            className="focus-visible:ring-ring shrink-0 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
          >
            <PlayerAvatar
              name={player.name}
              color={player.color}
              avatar={player.avatar}
            />
          </button>
        </DialogTrigger>
        <DialogContent className="max-h-[90svh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Customise {player.name}</DialogTitle>
          </DialogHeader>
          <AvatarCustomizer
            value={player.avatar ?? generateAvatar(player.id)}
            name={player.name}
            onChange={(avatar) => onAvatarChange(player.id, avatar)}
          />
          <DialogFooter>
            <DialogClose asChild>
              <Button>Continue</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Input
        value={player.name}
        onChange={(event) => onRename(player.id, event.target.value)}
        aria-label={`Name for player ${player.order + 1}`}
        maxLength={20}
        className="h-10 flex-1"
      />

      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="shrink-0"
        onClick={() => onRemove(player.id)}
        disabled={!canRemove}
        aria-label={`Remove ${player.name}`}
      >
        <X className="size-5" />
      </Button>
    </li>
  )
}

export function PlayerEditor({
  players,
  onRename,
  onAvatarChange,
  onRemove,
  onReorder,
}: PlayerEditorProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 150, tolerance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  const canRemove = players.length > PLAYER_LIMITS.min

  const nameOf = (id: UniqueIdentifier) =>
    players.find((p) => p.id === id)?.name ?? 'player'
  const positionOf = (id: UniqueIdentifier) =>
    players.findIndex((p) => p.id === id) + 1

  // Announce reordering with player names instead of raw ids.
  const announcements: Announcements = {
    onDragStart: ({ active }) =>
      `Picked up ${nameOf(active.id)}, position ${positionOf(active.id)} of ${players.length}.`,
    onDragOver: ({ active, over }) =>
      over
        ? `${nameOf(active.id)} moved to position ${positionOf(over.id)} of ${players.length}.`
        : undefined,
    onDragEnd: ({ active, over }) =>
      over
        ? `${nameOf(active.id)} dropped at position ${positionOf(over.id)} of ${players.length}.`
        : `${nameOf(active.id)} dropped.`,
    onDragCancel: ({ active }) =>
      `Reordering cancelled. ${nameOf(active.id)} returned to position ${positionOf(active.id)}.`,
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = players.findIndex((p) => p.id === active.id)
    const newIndex = players.findIndex((p) => p.id === over.id)
    if (oldIndex < 0 || newIndex < 0) return
    onReorder(arrayMove(players, oldIndex, newIndex).map((p) => p.id))
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
      accessibility={{ announcements }}
    >
      <SortableContext
        items={players.map((p) => p.id)}
        strategy={verticalListSortingStrategy}
      >
        <ul className="flex flex-col gap-2">
          {players.map((player) => (
            <SortablePlayerRow
              key={player.id}
              player={player}
              canRemove={canRemove}
              onRename={onRename}
              onAvatarChange={onAvatarChange}
              onRemove={onRemove}
            />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  )
}
