import type { Sticker } from './types'

/**
 * The first set of stickers. ~40 achievements spread across the eight
 * categories and five rarities. Each `metric`/`threshold` pair is evaluated
 * against {@link AchievementMetrics}; `art` names a motif in the art registry.
 *
 * Because the collection is device-level, player-scoped goals ("win 5 games")
 * unlock when *any* player on this device reaches them — the album celebrates
 * the household's best moments, not a single account.
 */
export const STICKERS: readonly Sticker[] = [
  // ---- Winning -----------------------------------------------------------
  {
    id: 'first-win',
    name: 'First Win',
    rarity: 'common',
    category: 'winning',
    art: 'trophy',
    achievement: {
      metric: 'bestWins',
      threshold: 1,
      hint: 'Win your first game.',
    },
  },
  {
    id: 'five-wins',
    name: 'High Five',
    rarity: 'rare',
    category: 'winning',
    art: 'rosette',
    achievement: { metric: 'bestWins', threshold: 5, hint: 'Win 5 games.' },
  },
  {
    id: 'ten-wins',
    name: 'Perfect Ten',
    rarity: 'rare',
    category: 'winning',
    art: 'medal',
    achievement: { metric: 'bestWins', threshold: 10, hint: 'Win 10 games.' },
  },
  {
    id: 'twenty-wins',
    name: 'Twenty Club',
    rarity: 'epic',
    category: 'winning',
    art: 'crown',
    achievement: { metric: 'bestWins', threshold: 20, hint: 'Win 20 games.' },
  },
  {
    id: 'legend',
    name: 'Legend',
    rarity: 'mythic',
    category: 'winning',
    art: 'crown-star',
    achievement: { metric: 'bestWins', threshold: 50, hint: 'Win 50 games.' },
  },
  {
    id: 'double-champion',
    name: 'Double Champion',
    rarity: 'rare',
    category: 'winning',
    art: 'double-trophy',
    achievement: {
      metric: 'bestWinStreak',
      threshold: 2,
      hint: 'Win two games in a row.',
    },
  },
  {
    id: 'dynasty',
    name: 'Dynasty',
    rarity: 'epic',
    category: 'winning',
    art: 'flame',
    achievement: {
      metric: 'bestWinStreak',
      threshold: 5,
      hint: 'Win five games in a row.',
    },
  },

  // ---- Scoring -----------------------------------------------------------
  {
    id: 'sharpshooter',
    name: 'Sharpshooter',
    rarity: 'common',
    category: 'scoring',
    art: 'target',
    achievement: {
      metric: 'highestRound',
      threshold: 30,
      hint: 'Score 30+ in a single round.',
    },
  },
  {
    id: 'fifty-round',
    name: 'Fifty Point Round',
    rarity: 'rare',
    category: 'scoring',
    art: 'fifty',
    achievement: {
      metric: 'highestRound',
      threshold: 50,
      hint: 'Score 50+ in a single round.',
    },
  },
  {
    id: 'big-banker',
    name: 'Big Banker',
    rarity: 'epic',
    category: 'scoring',
    art: 'coins',
    achievement: {
      metric: 'highestRound',
      threshold: 70,
      hint: 'Score 70+ in a single round.',
    },
  },
  {
    id: 'high-roller',
    name: 'High Roller',
    rarity: 'epic',
    category: 'scoring',
    art: 'gem-dice',
    achievement: {
      metric: 'highestTotal',
      threshold: 250,
      hint: 'Finish a game with 250+ points.',
    },
  },
  {
    id: 'grand-total',
    name: 'Grand Total',
    rarity: 'legendary',
    category: 'scoring',
    art: 'mountain',
    achievement: {
      metric: 'highestTotal',
      threshold: 350,
      hint: 'Finish a game with 350+ points.',
    },
  },

  // ---- Risk --------------------------------------------------------------
  {
    id: 'risk-taker',
    name: 'Risk Taker',
    rarity: 'common',
    category: 'risk',
    art: 'die',
    achievement: {
      metric: 'totalBusts',
      threshold: 1,
      hint: 'Bust for the first time — no risk, no reward.',
    },
  },
  {
    id: 'lucky-escape',
    name: 'Lucky Escape',
    rarity: 'rare',
    category: 'risk',
    art: 'parachute',
    achievement: {
      metric: 'winsWithBust',
      threshold: 1,
      hint: 'Win a game in which you busted.',
    },
  },
  {
    id: 'bust-master',
    name: 'Bust Master',
    rarity: 'rare',
    category: 'risk',
    art: 'skull',
    achievement: {
      metric: 'bestBusts',
      threshold: 25,
      hint: 'Bust 25 times across your games.',
    },
  },
  {
    id: 'daredevil',
    name: 'Daredevil',
    rarity: 'epic',
    category: 'risk',
    art: 'bomb',
    achievement: {
      metric: 'bestBusts',
      threshold: 50,
      hint: 'Bust 50 times — fortune favours the bold.',
    },
  },
  {
    id: 'all-in',
    name: 'All In',
    rarity: 'legendary',
    category: 'risk',
    art: 'chips',
    achievement: {
      metric: 'bestBusts',
      threshold: 100,
      hint: 'Bust 100 times. Fearless.',
    },
  },

  // ---- Luck --------------------------------------------------------------
  {
    id: 'lucky-seven',
    name: 'Lucky Seven',
    rarity: 'common',
    category: 'luck',
    art: 'clover',
    achievement: {
      metric: 'totalFlip7',
      threshold: 1,
      hint: 'Land your first Flip 7 bonus.',
    },
  },
  {
    id: 'seven-heaven',
    name: 'Seven Heaven',
    rarity: 'rare',
    category: 'luck',
    art: 'seven',
    achievement: {
      metric: 'totalFlip7',
      threshold: 7,
      hint: 'Land 7 Flip 7 bonuses.',
    },
  },
  {
    id: 'photo-finish',
    name: 'Photo Finish',
    rarity: 'rare',
    category: 'luck',
    art: 'ribbon',
    achievement: {
      metric: 'closeWins',
      threshold: 1,
      hint: 'Win a game by 3 points or fewer.',
    },
  },
  {
    id: 'flip-master',
    name: 'Flip Master',
    rarity: 'epic',
    category: 'luck',
    art: 'seven-star',
    achievement: {
      metric: 'bestFlip7',
      threshold: 15,
      hint: 'Land 15 Flip 7 bonuses as one player.',
    },
  },
  {
    id: 'jackpot',
    name: 'Jackpot',
    rarity: 'legendary',
    category: 'luck',
    art: 'sevens',
    achievement: {
      metric: 'totalFlip7',
      threshold: 25,
      hint: 'Land 25 Flip 7 bonuses.',
    },
  },

  // ---- Consistency -------------------------------------------------------
  {
    id: 'steady-hand',
    name: 'Steady Hand',
    rarity: 'common',
    category: 'consistency',
    art: 'balance',
    achievement: {
      metric: 'bestGamesPlayed',
      threshold: 10,
      hint: 'Play 10 games.',
    },
  },
  {
    id: 'comeback-king',
    name: 'Comeback King',
    rarity: 'epic',
    category: 'consistency',
    art: 'rising',
    achievement: {
      metric: 'comebackWins',
      threshold: 1,
      hint: 'Win after being in last place.',
    },
  },
  {
    id: 'biggest-comeback',
    name: 'Biggest Comeback',
    rarity: 'legendary',
    category: 'consistency',
    art: 'phoenix',
    achievement: {
      metric: 'bigComebackWins',
      threshold: 1,
      hint: 'Win after trailing the leader by 40+.',
    },
  },
  {
    id: 'ice-cold',
    name: 'Ice Cold',
    rarity: 'rare',
    category: 'consistency',
    art: 'ice',
    achievement: {
      metric: 'lowScoringWins',
      threshold: 1,
      hint: 'Win a game with a total of 120 or fewer.',
    },
  },
  {
    id: 'perfect-victory',
    name: 'Perfect Victory',
    rarity: 'legendary',
    category: 'consistency',
    art: 'gem',
    achievement: {
      metric: 'flawlessWins',
      threshold: 1,
      hint: 'Win a game without a single bust.',
    },
  },

  // ---- Social ------------------------------------------------------------
  {
    id: 'pass-it-on',
    name: 'Pass It On',
    rarity: 'common',
    category: 'social',
    art: 'phone',
    achievement: {
      metric: 'passGames',
      threshold: 1,
      hint: 'Play a Pass-and-Play game.',
    },
  },
  {
    id: 'better-together',
    name: 'Better Together',
    rarity: 'rare',
    category: 'social',
    art: 'link',
    achievement: {
      metric: 'connectedGames',
      threshold: 1,
      hint: 'Play a Connected game.',
    },
  },
  {
    id: 'full-table',
    name: 'Full Table',
    rarity: 'rare',
    category: 'social',
    art: 'people',
    achievement: {
      metric: 'biggestTable',
      threshold: 6,
      hint: 'Play a game with 6 or more players.',
    },
  },
  {
    id: 'party-mode',
    name: 'Party Mode',
    rarity: 'epic',
    category: 'social',
    art: 'confetti',
    achievement: {
      metric: 'biggestTable',
      threshold: 8,
      hint: 'Play a game with 8 or more players.',
    },
  },
  {
    id: 'host-with-the-most',
    name: 'Host with the Most',
    rarity: 'epic',
    category: 'social',
    art: 'antenna',
    achievement: {
      metric: 'connectedGames',
      threshold: 10,
      hint: 'Host 10 Connected games.',
    },
  },
  {
    id: 'the-gathering',
    name: 'The Gathering',
    rarity: 'legendary',
    category: 'social',
    art: 'globe',
    achievement: {
      metric: 'distinctPlayers',
      threshold: 20,
      hint: 'Play with 20 different people.',
    },
  },

  // ---- Milestones --------------------------------------------------------
  {
    id: 'first-steps',
    name: 'First Steps',
    rarity: 'common',
    category: 'milestones',
    art: 'flag',
    achievement: {
      metric: 'gamesFinished',
      threshold: 1,
      hint: 'Finish your first game.',
    },
  },
  {
    id: 'getting-serious',
    name: 'Getting Serious',
    rarity: 'common',
    category: 'milestones',
    art: 'cards',
    achievement: {
      metric: 'gamesFinished',
      threshold: 10,
      hint: 'Finish 10 games.',
    },
  },
  {
    id: 'marathon',
    name: 'Marathon',
    rarity: 'rare',
    category: 'milestones',
    art: 'track',
    achievement: {
      metric: 'roundsPlayed',
      threshold: 100,
      hint: 'Play 100 rounds.',
    },
  },
  {
    id: 'half-century',
    name: 'Half Century',
    rarity: 'epic',
    category: 'milestones',
    art: 'fifty',
    achievement: {
      metric: 'gamesFinished',
      threshold: 50,
      hint: 'Finish 50 games.',
    },
  },
  {
    id: 'century',
    name: 'Century',
    rarity: 'legendary',
    category: 'milestones',
    art: 'hundred',
    achievement: {
      metric: 'gamesFinished',
      threshold: 100,
      hint: 'Finish 100 games.',
    },
  },

  // ---- Seasonal ----------------------------------------------------------
  {
    id: 'weekend-warrior',
    name: 'Weekend Warrior',
    rarity: 'common',
    category: 'seasonal',
    art: 'deckchair',
    achievement: {
      metric: 'weekendGames',
      threshold: 1,
      hint: 'Finish a game at the weekend.',
    },
  },
  {
    id: 'night-owl',
    name: 'Night Owl',
    rarity: 'rare',
    category: 'seasonal',
    art: 'moon',
    achievement: {
      metric: 'lateNightGames',
      threshold: 1,
      hint: 'Finish a game after midnight.',
    },
  },
  {
    id: 'summer-streak',
    name: 'Summer Streak',
    rarity: 'rare',
    category: 'seasonal',
    art: 'sun',
    achievement: {
      metric: 'seasonSummer',
      threshold: 1,
      hint: 'Finish a game in summer (Jun–Aug).',
    },
  },
  {
    id: 'festive-flipper',
    name: 'Festive Flipper',
    rarity: 'epic',
    category: 'seasonal',
    art: 'tree',
    achievement: {
      metric: 'seasonDecember',
      threshold: 1,
      hint: 'Finish a game in December.',
    },
  },
  {
    id: 'new-year-new-flip',
    name: 'New Year, New Flip',
    rarity: 'legendary',
    category: 'seasonal',
    art: 'fireworks',
    achievement: {
      metric: 'seasonNewYear',
      threshold: 1,
      hint: "Finish a game on New Year's Day.",
    },
  },

  // ---- Action cards ------------------------------------------------------
  {
    id: 'second-chance',
    name: 'Second Chance',
    rarity: 'common',
    category: 'luck',
    art: 'parachute',
    achievement: {
      metric: 'secondChances',
      threshold: 1,
      hint: 'Use a Second Chance card.',
    },
  },
  {
    id: 'deep-freeze',
    name: 'Deep Freeze',
    rarity: 'rare',
    category: 'risk',
    art: 'ice',
    achievement: {
      metric: 'freezes',
      threshold: 10,
      hint: 'Record 10 Freeze cards.',
    },
  },
  {
    id: 'triple-threat',
    name: 'Triple Threat',
    rarity: 'epic',
    category: 'risk',
    art: 'die',
    achievement: {
      metric: 'flipThrees',
      threshold: 10,
      hint: 'Record 10 Flip Three cards.',
    },
  },
]

/** Fast lookup by id. */
export const STICKERS_BY_ID: ReadonlyMap<string, Sticker> = new Map(
  STICKERS.map((s) => [s.id, s]),
)
