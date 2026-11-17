import { describe, expect, it } from "vitest";
import { automaticMatch, rankCandidates, validateAllocation, type MatchPolicy, type MatchTarget } from "../../src/reconciliation/match.js";

// Spec 002 · R-CORE-007: el casado automático solo ocurre si es inequívoco; la política es un dato.
const PROPERTY: MatchPolicy = { requireIdentification: true };
const HS: MatchPolicy = { requireIdentification: false, windowDays: 3 };

const target = (over: Partial<MatchTarget> & { id: string }): MatchTarget => ({ pending: 118_000n, currency: "DOP", date: "2026-10-01", references: [], names: [], ...over });
const movement = (over: Partial<{ amount: bigint; currency: string; text: string; bookedOn: string }> = {}) => ({ amount: 118_000n, currency: "DOP", text: "Transferencia", bookedOn: "2026-10-02", ...over });

describe("[R-CORE-007] casado automático inequívoco", () => {
  it("Property: importe exacto más referencia (número fiscal) casa solo", () => {
    const c = rankCandidates(movement({ text: "Pago factura E31-0000000123" }), [target({ id: "a", references: ["E310000000123"] }), target({ id: "b" })], PROPERTY);
    expect(c[0]).toMatchObject({ targetId: "a", exact: true, byReference: true });
    expect(automaticMatch(c, PROPERTY)?.targetId).toBe("a");
  });

  it("Property: el nombre cuenta si están todas sus palabras significativas (sin formas jurídicas)", () => {
    const c = rankCandidates(movement({ text: "TRANSF GESTORA DEL SOL" }), [target({ id: "a", names: ["Gestora del Sol SRL"] })], PROPERTY);
    expect(c[0]?.byName).toBe(true);
    expect(automaticMatch(c, PROPERTY)?.targetId).toBe("a");
  });

  it("Property: importe exacto sin identificación, o empate, no casa solo", () => {
    expect(automaticMatch(rankCandidates(movement(), [target({ id: "a" })], PROPERTY), PROPERTY)).toBeNull();
    const tie = rankCandidates(movement({ text: "Gestora Sol" }), [target({ id: "a", names: ["Gestora Sol"] }), target({ id: "b", names: ["Gestora Sol"] })], PROPERTY);
    expect(automaticMatch(tie, PROPERTY)).toBeNull();
  });

  it("HS: importe exacto en la ventana de 3 días y un solo candidato casa; fuera de la ventana no", () => {
    expect(automaticMatch(rankCandidates(movement(), [target({ id: "a", date: "2026-09-29" })], HS), HS)?.targetId).toBe("a");
    expect(automaticMatch(rankCandidates(movement(), [target({ id: "a", date: "2026-09-20" })], HS), HS)).toBeNull();
  });

  it("HS: dos candidatos iguales en la ventana son ambiguos salvo que la referencia desempate", () => {
    const twins = [target({ id: "a", date: "2026-10-01" }), target({ id: "b", date: "2026-10-02", references: ["REF-9"] })];
    expect(automaticMatch(rankCandidates(movement(), twins, HS), HS)).toBeNull();
    expect(automaticMatch(rankCandidates(movement({ text: "pago REF-9" }), twins, HS), HS)?.targetId).toBe("b");
  });

  it("otra moneda o sin pendiente no son candidatos; el signo cuenta (un cargo no casa con un cobro)", () => {
    expect(rankCandidates(movement({ currency: "USD" }), [target({ id: "a" })], HS)).toEqual([]);
    expect(rankCandidates(movement(), [target({ id: "a", pending: 0n })], HS)).toEqual([]);
    expect(automaticMatch(rankCandidates(movement({ amount: -118_000n }), [target({ id: "a" })], HS), HS)).toBeNull();
  });
});

describe("reparto de un ingreso entre destinos (bigint)", () => {
  const t = (id: string, pending: bigint, currency = "DOP") => target({ id, pending, currency });
  it("acepta un reparto válido y rechaza cada error", () => {
    expect(validateAllocation({ remaining: 1_000n, currency: "DOP" }, [{ amount: 600n, target: t("a", 600n) }, { amount: 400n, target: t("b", 500n) }])).toBeNull();
    expect(validateAllocation({ remaining: -1n, currency: "DOP" }, [])).toBe("wrong_direction");
    expect(validateAllocation({ remaining: 1_000n, currency: "DOP" }, [{ amount: 0n, target: t("a", 1n) }])).toBe("invalid_amount");
    expect(validateAllocation({ remaining: 1_000n, currency: "DOP" }, [{ amount: 1n, target: t("a", 5n) }, { amount: 1n, target: t("a", 5n) }])).toBe("duplicate_target");
    expect(validateAllocation({ remaining: 1_000n, currency: "DOP" }, [{ amount: 1n, target: t("a", 5n, "EUR") }])).toBe("currency_mismatch");
    expect(validateAllocation({ remaining: 1_000n, currency: "DOP" }, [{ amount: 6n, target: t("a", 5n) }])).toBe("exceeds_target");
    expect(validateAllocation({ remaining: 10n, currency: "DOP" }, [{ amount: 6n, target: t("a", 6n) }, { amount: 6n, target: t("b", 6n) }])).toBe("exceeds_movement");
  });
});
