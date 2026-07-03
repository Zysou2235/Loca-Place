export type { ShipmentInput, ShipmentResult } from "./mondial-relay";

import type { ShipmentInput, ShipmentResult } from "./mondial-relay";
import { isMondialRelayConfigured, createMondialRelayLabel } from "./mondial-relay";
import { isDpdConfigured, createDpdLabel } from "./dpd";
import { isChronopostConfigured, createChronopostLabel } from "./chronopost";

export type Carrier = "mondial_relay" | "dpd" | "chronopost";

export const CARRIER_LABELS: Record<Carrier, string> = {
  mondial_relay: "Mondial Relay",
  dpd: "DPD",
  chronopost: "Chronopost",
};

export function isCarrierConfigured(carrier: Carrier): boolean {
  switch (carrier) {
    case "mondial_relay":
      return isMondialRelayConfigured();
    case "dpd":
      return isDpdConfigured();
    case "chronopost":
      return isChronopostConfigured();
  }
}

/** Point d'entrée unique pour générer une étiquette, quel que soit le transporteur. */
export async function createShippingLabel(
  carrier: Carrier,
  input: ShipmentInput
): Promise<ShipmentResult> {
  switch (carrier) {
    case "mondial_relay":
      return createMondialRelayLabel(input);
    case "dpd":
      return createDpdLabel(input);
    case "chronopost":
      return createChronopostLabel(input);
  }
}
