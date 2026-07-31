import type { CodegenConfig } from "@graphql-codegen/cli"
import type { ASTNode, DocumentNode, OperationDefinitionNode } from "graphql"
import { Kind, visit } from "graphql"

type LoadedDocument = {
  document?: DocumentNode
  [key: string]: unknown
}

function isOperationDefinitionNode(
  node: ASTNode | readonly ASTNode[] | undefined,
): node is OperationDefinitionNode {
  if (node == null || Array.isArray(node)) {
    return false
  }

  return (node as ASTNode).kind === Kind.OPERATION_DEFINITION
}

const addTypenameSelectionDocumentTransform = {
  transform({ documents }: { documents: LoadedDocument[] }) {
    return documents.map((document) => ({
      ...document,
      document: document.document
        ? visit(document.document, {
            SelectionSet(node, _key, parent) {
              const isSubscriptionRoot =
                isOperationDefinitionNode(parent) && parent.operation === "subscription"
              if (
                isSubscriptionRoot ||
                node.selections.some(
                  (selection) =>
                    selection.kind === Kind.FIELD && selection.name.value === "__typename",
                )
              ) {
                return undefined
              }

              return {
                ...node,
                selections: [
                  { kind: Kind.FIELD, name: { kind: Kind.NAME, value: "__typename" } },
                  ...node.selections,
                ],
              }
            },
          })
        : undefined,
    }))
  },
} as const

const config = {
  schema: "src/gql/schema.graphql",
  documents: ["src/gql/operations/**/*.graphql"],
  generates: {
    "src/gql/operations/": {
      preset: "near-operation-file",
      presetConfig: {
        extension: ".generated.ts",
        baseTypesPath: "./base-types.js",
      },
      documentTransforms: [addTypenameSelectionDocumentTransform],
      plugins: ["typescript-operations", "typed-document-node"],
      config: {
        useTypeImports: true,
        documentMode: "documentNode",
        preResolveTypes: true,
        defaultScalarType: "any",
        nonOptionalTypename: true,
        onlyOperationTypes: true,
        emitLegacyCommonJSImports: false,
        rawRequest: false,
      },
    },
  },
  ignoreNoDocuments: false,
} as CodegenConfig

export default config
