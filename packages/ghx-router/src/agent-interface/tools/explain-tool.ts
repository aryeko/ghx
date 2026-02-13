import { getOperationCard } from "../../core/registry/index.js"

export type CapabilityExplanation = {
  capability_id: string
  purpose: string
  required_inputs: string[]
  preferred_route: "cli" | "graphql" | "rest"
  fallback_routes: Array<"cli" | "graphql" | "rest">
  output_fields: string[]
}

function extractRequiredInputs(inputSchema: Record<string, unknown>): string[] {
  const required = inputSchema.required
  if (!Array.isArray(required)) {
    return []
  }

  return required.filter((entry): entry is string => typeof entry === "string")
}

function extractOutputFields(outputSchema: Record<string, unknown>): string[] {
  const properties = outputSchema.properties
  if (!properties || typeof properties !== "object") {
    return []
  }

  return Object.keys(properties)
}

export function explainCapability(capabilityId: string): CapabilityExplanation {
  const card = getOperationCard(capabilityId)
  if (!card) {
    throw new Error(`Unknown capability: ${capabilityId}`)
  }

  return {
    capability_id: card.capability_id,
    purpose: card.description,
    required_inputs: extractRequiredInputs(card.input_schema),
    preferred_route: card.routing.preferred,
    fallback_routes: [...card.routing.fallbacks],
    output_fields: extractOutputFields(card.output_schema)
  }
}
