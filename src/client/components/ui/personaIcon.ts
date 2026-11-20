import { Bot, Fish, Flame, Scale, Sprout, Turtle } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { personaOf } from '../../bots/personas';
import type { PersonaId } from '../../bots/personas';

const ICONS: Record<PersonaId, LucideIcon> = {
  shark: Fish,
  regular: Scale,
  hothead: Flame,
  turtle: Turtle,
  rookie: Sprout,
};

/** The icon for a personality id; the plain bot icon for anything else. */
export const personaIcon = (id: unknown): LucideIcon => {
  const persona = personaOf(id);
  return persona ? ICONS[persona.id] : Bot;
};
