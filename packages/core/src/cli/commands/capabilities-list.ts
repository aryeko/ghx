import { listCapabilities } from "@core/core/registry/list-capabilities.js"

function parseArgs(argv: string[]): { asJson: boolean; domain: string | undefined } {
  const domainIndex = argv.indexOf("--domain")
  return {
    asJson: argv.includes("--json"),
    domain: domainIndex !== -1 ? argv[domainIndex + 1] : undefined,
  }
}

function renderOptionalInput(name: string, detail: Record<string, unknown>): string {
  const prop = detail[name]
  if (!prop || typeof prop !== "object") return `${name}?`
  const propObj = prop as Record<string, unknown>
  if (propObj.type !== "array") return `${name}?`
  const items = propObj.items
  if (!items || typeof items !== "object") return `${name}?`
  const itemObj = items as Record<string, unknown>
  const itemProps = itemObj.properties
  if (!itemProps || typeof itemProps !== "object") return `${name}?`
  const requiredSet = new Set<string>(
    Array.isArray(itemObj.required) ? (itemObj.required as string[]) : [],
  )
  const fields: string[] = []
  for (const fieldName of Object.keys(itemProps as Record<string, unknown>)) {
    fields.push(requiredSet.has(fieldName) ? fieldName : `${fieldName}?`)
  }
  return `${name}?[${fields.join(", ")}]`
}

export async function capabilitiesListCommand(argv: string[] = []): Promise<number> {
  const { asJson, domain } = parseArgs(argv)
  const capabilities = listCapabilities(domain)

  if (capabilities.length === 0) {
    process.stderr.write(
      domain ? `No capabilities found for domain: ${domain}\n` : "No capabilities found\n",
    )
    return 1
  }

  if (asJson) {
    process.stdout.write(`${JSON.stringify(capabilities)}\n`)
    return 0
  }

  const maxIdLen = Math.max(...capabilities.map((c) => c.capability_id.length))
  const maxDescLen = Math.max(...capabilities.map((c) => c.description.length))

  const lines = capabilities.map((item) => {
    const id = item.capability_id.padEnd(maxIdLen)
    const desc = item.description.padEnd(maxDescLen)
    const required = item.required_inputs.join(", ")
    const optional = item.optional_inputs
      .map((n) => renderOptionalInput(n, item.optional_inputs_detail))
      .join(", ")
    const inputs = optional.length > 0 ? `[${required}, ${optional}]` : `[${required}]`
    return `${id} - ${desc} ${inputs}`
  })
  process.stdout.write(`${lines.join("\n")}\n`)
  return 0
}
