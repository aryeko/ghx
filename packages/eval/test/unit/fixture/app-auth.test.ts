import { createSign } from "node:crypto"
import { readFile } from "node:fs/promises"

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const signer = vi.hoisted(() => ({
  update: vi.fn(),
  end: vi.fn(),
  sign: vi.fn(),
}))

vi.mock("node:crypto", () => ({ createSign: vi.fn(() => signer) }))
vi.mock("node:fs/promises", () => ({ readFile: vi.fn() }))

import { mintFixtureAppToken } from "@eval/fixture/app-auth.js"

const mockCreateSign = vi.mocked(createSign)
const mockReadFile = vi.mocked(readFile)
const mockFetch = vi.fn<typeof fetch>()

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  })
}

beforeEach(() => {
  vi.stubGlobal("fetch", mockFetch)
  signer.update.mockReturnValue(signer)
  signer.end.mockReturnValue(signer)
  signer.sign.mockReturnValue(Buffer.from("signature"))
})

afterEach(() => {
  vi.clearAllMocks()
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe("mintFixtureAppToken", () => {
  it("returns null when app authentication is not configured", async () => {
    await expect(mintFixtureAppToken("owner/repo")).resolves.toBeNull()
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it.each([
    ["client ID only", "app-client", undefined],
    ["private key only", undefined, "PRIVATE KEY"],
    ["blank private key", "app-client", "   "],
  ])("rejects incomplete configuration: %s", async (_label, clientId, privateKey) => {
    if (clientId !== undefined) vi.stubEnv("BENCH_FIXTURE_GH_APP_CLIENT_ID", clientId)
    if (privateKey !== undefined) vi.stubEnv("BENCH_FIXTURE_GH_APP_PRIVATE_KEY", privateKey)

    await expect(mintFixtureAppToken("owner/repo")).rejects.toThrow("Incomplete fixture app auth")
  })

  it("reads a private key from the configured path", async () => {
    vi.stubEnv("BENCH_FIXTURE_GH_APP_CLIENT_ID", "app-client")
    vi.stubEnv("BENCH_FIXTURE_GH_APP_PRIVATE_KEY_PATH", "/secure/app.pem")
    mockReadFile.mockResolvedValue("FILE PRIVATE KEY")
    mockFetch
      .mockResolvedValueOnce(jsonResponse({ id: 123 }))
      .mockResolvedValueOnce(jsonResponse({ token: "installation-token" }))

    await expect(mintFixtureAppToken("owner/repo")).resolves.toBe("installation-token")
    expect(mockReadFile).toHaveBeenCalledWith("/secure/app.pem", "utf8")
    expect(signer.sign).toHaveBeenCalledWith("FILE PRIVATE KEY")
  })

  it("normalizes escaped newlines in an inline private key", async () => {
    vi.stubEnv("BENCH_FIXTURE_GH_APP_CLIENT_ID", "app-client")
    vi.stubEnv("BENCH_FIXTURE_GH_APP_PRIVATE_KEY", "PRIVATE\\nKEY")
    mockFetch
      .mockResolvedValueOnce(jsonResponse({ id: 123 }))
      .mockResolvedValueOnce(jsonResponse({ token: "installation-token" }))

    await mintFixtureAppToken("owner/repo")

    expect(mockCreateSign).toHaveBeenCalledWith("RSA-SHA256")
    expect(signer.sign).toHaveBeenCalledWith("PRIVATE\nKEY")
  })

  it.each(["owner", "/repo", "owner/"])("rejects invalid repository format %s", async (repo) => {
    vi.stubEnv("BENCH_FIXTURE_GH_APP_CLIENT_ID", "app-client")
    vi.stubEnv("BENCH_FIXTURE_GH_APP_PRIVATE_KEY", "PRIVATE KEY")

    await expect(mintFixtureAppToken(repo)).rejects.toThrow("Invalid repo format")
  })

  it("rejects a failed installation lookup", async () => {
    vi.stubEnv("BENCH_FIXTURE_GH_APP_CLIENT_ID", "app-client")
    vi.stubEnv("BENCH_FIXTURE_GH_APP_PRIVATE_KEY", "PRIVATE KEY")
    mockFetch.mockResolvedValueOnce(jsonResponse({ message: "not found" }, 404))

    await expect(mintFixtureAppToken("owner/repo")).rejects.toThrow(
      "Failed to get app installation for owner/repo (404)",
    )
  })

  it("rejects an installation lookup without a numeric id", async () => {
    vi.stubEnv("BENCH_FIXTURE_GH_APP_CLIENT_ID", "app-client")
    vi.stubEnv("BENCH_FIXTURE_GH_APP_PRIVATE_KEY", "PRIVATE KEY")
    mockFetch.mockResolvedValueOnce(jsonResponse({ id: "123" }))

    await expect(mintFixtureAppToken("owner/repo")).rejects.toThrow(
      "No installation found for owner/repo",
    )
  })

  it("rejects a failed token request", async () => {
    vi.stubEnv("BENCH_FIXTURE_GH_APP_CLIENT_ID", "app-client")
    vi.stubEnv("BENCH_FIXTURE_GH_APP_PRIVATE_KEY", "PRIVATE KEY")
    mockFetch
      .mockResolvedValueOnce(jsonResponse({ id: 123 }))
      .mockResolvedValueOnce(jsonResponse({ message: "forbidden" }, 403))

    await expect(mintFixtureAppToken("owner/repo")).rejects.toThrow(
      "Failed to mint fixture app token (403)",
    )
  })

  it.each([{ token: 123 }, { token: "" }])(
    "rejects an invalid token response: %j",
    async (body) => {
      vi.stubEnv("BENCH_FIXTURE_GH_APP_CLIENT_ID", "app-client")
      vi.stubEnv("BENCH_FIXTURE_GH_APP_PRIVATE_KEY", "PRIVATE KEY")
      mockFetch
        .mockResolvedValueOnce(jsonResponse({ id: 123 }))
        .mockResolvedValueOnce(jsonResponse(body))

      await expect(mintFixtureAppToken("owner/repo")).rejects.toThrow(
        "App token response missing token field",
      )
    },
  )
})
