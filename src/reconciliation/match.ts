import type { CivilDate, Minor } from "../core/types.js";

// Spec 002 · R-CORE-007: casado de un movimiento bancario con sus posibles destinos (facturas,
// cuotas, movimientos esperados). La política es un dato de cada app: Property exige
// identificación (decisión del dueño 2026-10-30); HS acepta importe exacto en ±3 días si no hay
// ambigüedad. Nunca casa solo ante un empate.

export interface MatchPolicy {
  /** Exigir referencia o nombre además del importe exacto. */
  readonly requireIdentification: boolean;
  /** Ventana de días entre el movimiento y el destino; sin ella, no se mira la fecha. */
  readonly windowDays?: number | undefined;
  /** Desempate a igual puntuación: la fecha más cercana (por defecto, HS) o el destino más antiguo (Property). */
  readonly tieBreak?: "closest" | "oldest" | undefined;
}

export interface MatchTarget {
  readonly id: string;
  /** Pendiente del destino, con el mismo signo que el movimiento esperado. */
  readonly pending: Minor;
  readonly currency: string;
  readonly date: CivilDate;
  /** Referencias que lo identifican (número fiscal, referencia de pago, id largo). */
  readonly references: readonly string[];
  /** Nombres de la contraparte (organización, cliente). */
  readonly names: readonly string[];
}

export interface MatchMovement {
  readonly amount: Minor;
  readonly currency: string;
  /** Concepto + contraparte + referencia del movimiento. */
  readonly text: string;
  readonly bookedOn: CivilDate;
}

export interface MatchCandidate {
  readonly targetId: string;
  readonly exact: boolean;
  readonly byReference: boolean;
  readonly byName: boolean;
  readonly inWindow: boolean;
  readonly score: number;
}

// Formas jurídicas que no identifican a nadie.
const LEGAL_FORMS = new Set(["srl", "sas", "sa", "sl", "slu", "eirl", "sociedad", "limitada", "anonima", "inc", "llc"]);
const words = (s: string): string[] =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").split(/[^a-z0-9]+/).filter((t) => t.length >= 3 && !LEGAL_FORMS.has(t));
const compact = (s: string): string => s.toUpperCase().replace(/[^A-Z0-9]/g, "");
const days = (a: CivilDate, b: CivilDate): number => Math.abs(Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86_400_000;

/** Una referencia cuenta si aparece en el texto (sin separadores) y tiene al menos 4 caracteres. */
const mentionsReference = (text: string, refs: readonly string[]): boolean => refs.some((r) => compact(r).length >= 4 && compact(text).includes(compact(r)));

/** Un nombre cuenta si TODAS sus palabras significativas aparecen en el texto. */
function mentionsName(text: string, names: readonly string[]): boolean {
  const textWords = new Set(words(text));
  return names.some((n) => {
    const w = words(n);
    return w.length > 0 && w.every((x) => textWords.has(x));
  });
}

/** Destinos posibles, del más probable al menos: importe exacto +40, referencia +60, nombre +30; desempate según la política. */
export function rankCandidates(movement: MatchMovement, targets: readonly MatchTarget[], policy: MatchPolicy): MatchCandidate[] {
  return targets
    .filter((t) => t.currency === movement.currency && t.pending !== 0n && (t.pending > 0n) === (movement.amount > 0n))
    .map((t) => {
      const exact = t.pending === movement.amount;
      const byReference = mentionsReference(movement.text, t.references);
      const byName = mentionsName(movement.text, t.names);
      const distance = days(t.date, movement.bookedOn);
      const inWindow = policy.windowDays === undefined || distance <= policy.windowDays;
      return { targetId: t.id, exact, byReference, byName, inWindow, score: (exact ? 40 : 0) + (byReference ? 60 : 0) + (byName ? 30 : 0), distance, date: t.date };
    })
    .sort((a, b) => b.score - a.score || (policy.tieBreak === "oldest" ? a.date.localeCompare(b.date) : a.distance - b.distance))
    .map(({ distance: _distance, date: _date, ...c }) => c);
}

/** Casado automático: un único candidato claro según la política; si hay empate, ninguno (revisión manual). */
export function automaticMatch(candidates: readonly MatchCandidate[], policy: MatchPolicy): MatchCandidate | null {
  const clear = candidates.filter((c) => c.exact && c.inWindow && (!policy.requireIdentification || c.byReference || c.byName));
  const [best, second] = clear;
  if (!best) return null;
  if (second && second.score === best.score) return null;
  return best;
}

export type AllocationError = "wrong_direction" | "invalid_amount" | "duplicate_target" | "currency_mismatch" | "exceeds_target" | "exceeds_movement";

/** Reparto de un ingreso entre destinos: misma moneda, sin repetir destino ni superar su pendiente ni el del movimiento. */
export function validateAllocation(movement: { readonly remaining: Minor; readonly currency: string }, parts: readonly { readonly amount: Minor; readonly target: MatchTarget }[]): AllocationError | null {
  if (movement.remaining <= 0n) return "wrong_direction";
  const seen = new Set<string>();
  let total = 0n;
  for (const { amount, target } of parts) {
    if (amount <= 0n) return "invalid_amount";
    if (seen.has(target.id)) return "duplicate_target";
    seen.add(target.id);
    if (target.currency !== movement.currency) return "currency_mismatch";
    if (amount > target.pending) return "exceeds_target";
    total += amount;
  }
  return total > movement.remaining ? "exceeds_movement" : null;
}
