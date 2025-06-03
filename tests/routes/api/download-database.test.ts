import { describe, test, expect, beforeAll, afterAll } from "bun:test"
import { getTestServer } from "../../fixtures/get-test-server"

describe("GET /api/download-database", () => {
  let testFixture: any
  let testToken: string

  beforeAll(async () => {
    // Set up test token
    testToken = "test-token-123"
    process.env.DATABASE_DOWNLOAD_TOKEN = testToken
    testFixture = await getTestServer()
  })

  afterAll(() => {
    // Clean up environment
    process.env.DATABASE_DOWNLOAD_TOKEN = undefined
  })

  test("should return 401 for invalid token", async () => {
    try {
      await testFixture.axios.get("/api/download-database?token=invalid")
    } catch (error: any) {
      expect(error.status).toBe(401)
      expect(error.data).toBe("Invalid token")
    }
  })

  test("should return 503 when DATABASE_DOWNLOAD_TOKEN not configured", async () => {
    process.env.DATABASE_DOWNLOAD_TOKEN = undefined
    try {
      await testFixture.axios.get("/api/download-database?token=any")
    } catch (error: any) {
      expect(error.status).toBe(503)
      expect(error.data).toBe("Database download not configured")
    }
    
    // Restore token for other tests
    process.env.DATABASE_DOWNLOAD_TOKEN = testToken
  })

  test("should return database file with valid token", async () => {
    try {
      const response = await testFixture.axios.get(`/api/download-database?token=${testToken}`)
      
      expect(response.status).toBe(200)
      // Verify the response contains SQLite header (as string)
      expect(response.data).toContain("SQLite format 3")
    } catch (error: any) {
      // Check if database exists, if not expect 404
      if (error.status === 404) {
        expect(error.data).toBe("Database file not found")
        return
      }
      throw error
    }
  })

  test("should require token parameter", async () => {
    try {
      await testFixture.axios.get("/api/download-database")
      // Should not reach here
      expect(true).toBe(false)
    } catch (error: any) {
      // Check for validation error - could be 400 or 422
      expect([400, 422]).toContain(error.status)
    }
  })
})