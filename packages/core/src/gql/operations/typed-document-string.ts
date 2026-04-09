/**
 * Lightweight typed string wrapper for GraphQL documents.
 *
 * Emitted by `@graphql-codegen/typescript-graphql-request` v7+ when
 * `documentMode: "string"`. Extends `String` so it can be coerced to a
 * plain query string at the transport layer (`String(doc)` or template
 * interpolation) while preserving result/variable type information at
 * compile time.
 *
 * Modelled after the helper that `@graphql-codegen/client-preset`
 * auto-generates into `graphql.ts`.
 */
export class TypedDocumentString<_TResult = unknown, _TVariables = unknown> extends String {
  constructor(
    private readonly value: string,
    public readonly __meta__?: Record<string, unknown>,
  ) {
    super(value)
  }

  override toString(): string {
    return this.value
  }
}
