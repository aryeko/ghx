export const operationCardSchema = {
  $id: "https://ghx.local/schemas/operation-card.json",
  type: "object",
  required: ["capability_id", "version", "description", "input_schema", "output_schema", "routing"],
  properties: {
    capability_id: { type: "string", minLength: 1 },
    version: { type: "string", minLength: 1 },
    description: { type: "string", minLength: 1 },
    input_schema: { type: "object" },
    output_schema: { type: "object" },
    routing: {
      type: "object",
      required: ["preferred", "fallbacks"],
      properties: {
        preferred: { enum: ["cli", "graphql", "rest"] },
        fallbacks: {
          type: "array",
          items: { enum: ["cli", "graphql", "rest"] },
        },
        suitability: {
          type: "array",
          items: {
            type: "object",
            required: ["when", "predicate", "reason"],
            properties: {
              when: { enum: ["always", "env", "params"] },
              predicate: { type: "string", minLength: 1 },
              reason: { type: "string", minLength: 1 },
            },
            additionalProperties: false,
          },
        },
        notes: {
          type: "array",
          items: { type: "string" },
        },
      },
      additionalProperties: false,
    },
    graphql: {
      type: "object",
      required: ["operationName", "documentPath"],
      properties: {
        operationName: { type: "string", minLength: 1 },
        documentPath: { type: "string", minLength: 1 },
        variables: { type: "object" },
        limits: {
          type: "object",
          properties: {
            maxPageSize: { type: "number" },
          },
          additionalProperties: false,
        },
        resolution: {
          type: "object",
          required: ["lookup", "inject"],
          properties: {
            lookup: {
              type: "object",
              required: ["operationName", "documentPath", "vars"],
              properties: {
                operationName: { type: "string", minLength: 1 },
                documentPath: { type: "string", minLength: 1 },
                vars: { type: "object" },
              },
              additionalProperties: false,
            },
            inject: {
              type: "array",
              minItems: 1,
              items: {
                oneOf: [
                  {
                    type: "object",
                    required: ["target", "source", "path"],
                    properties: {
                      target: { type: "string", minLength: 1 },
                      source: { const: "scalar" },
                      path: { type: "string", minLength: 1 },
                    },
                    additionalProperties: false,
                  },
                  {
                    type: "object",
                    required: [
                      "target",
                      "source",
                      "from_input",
                      "nodes_path",
                      "match_field",
                      "extract_field",
                    ],
                    properties: {
                      target: { type: "string", minLength: 1 },
                      source: { const: "map_array" },
                      from_input: { type: "string", minLength: 1 },
                      nodes_path: { type: "string", minLength: 1 },
                      match_field: { type: "string", minLength: 1 },
                      extract_field: { type: "string", minLength: 1 },
                    },
                    additionalProperties: false,
                  },
                ],
              },
            },
          },
          additionalProperties: false,
        },
      },
      additionalProperties: false,
    },
    cli: {
      type: "object",
      required: ["command"],
      properties: {
        command: { type: "string", minLength: 1 },
        jsonFields: {
          type: "array",
          items: { type: "string", minLength: 1 },
        },
        jq: { type: "string" },
        limits: {
          type: "object",
          properties: {
            maxItemsPerCall: { type: "number" },
          },
          additionalProperties: false,
        },
      },
      additionalProperties: false,
    },
    rest: {
      type: "object",
      required: ["endpoints"],
      properties: {
        endpoints: {
          type: "array",
          items: {
            type: "object",
            required: ["method", "path"],
            properties: {
              method: { type: "string" },
              path: { type: "string" },
            },
            additionalProperties: false,
          },
        },
      },
      additionalProperties: false,
    },
    composite: {
      type: "object",
      required: ["steps", "output_strategy"],
      properties: {
        steps: {
          type: "array",
          minItems: 1,
          items: {
            type: "object",
            required: ["capability_id", "params_map"],
            properties: {
              capability_id: { type: "string", minLength: 1 },
              foreach: { type: "string", minLength: 1 },
              actions: {
                type: "array",
                minItems: 1,
                items: { type: "string", minLength: 1 },
              },
              requires_any_of: {
                type: "array",
                minItems: 1,
                items: { type: "string", minLength: 1 },
              },
              params_map: { type: "object" },
            },
            additionalProperties: false,
          },
        },
        output_strategy: { enum: ["merge", "array", "last"] },
      },
      additionalProperties: false,
    },
    examples: {
      type: "array",
      items: {
        type: "object",
        required: ["title", "input"],
        properties: {
          title: { type: "string" },
          input: { type: "object" },
        },
        additionalProperties: false,
      },
    },
  },
  additionalProperties: false,
} as const
