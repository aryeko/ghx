import type { CodegenConfig } from "@graphql-codegen/cli"

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
      // Note: typescript-graphql-request generates a `SdkFunctionWrapper` type with
      // `variables?: any`. This is hardcoded in the plugin template and cannot be
      // changed without a custom plugin or fork. Since generated files are never
      // edited manually and Biome linting is disabled for this project, this `any`
      // does not affect CI or runtime behavior. Tracked as a known limitation.
      //
      // The `add` plugin injects the TypedDocumentString import that v7 of
      // typescript-graphql-request requires (it emits `new TypedDocumentString()`
      // but does not generate the import itself when using near-operation-file preset).
      plugins: [
        {
          add: {
            content: 'import { TypedDocumentString } from "./typed-document-string.js"',
          },
        },
        "typescript-operations",
        "typescript-graphql-request",
      ],
      config: {
        useTypeImports: true,
        documentMode: "string",
        preResolveTypes: true,
        onlyOperationTypes: true,
        emitLegacyCommonJSImports: false,
        rawRequest: false,
      },
    },
  },
  ignoreNoDocuments: false,
} as CodegenConfig

export default config
