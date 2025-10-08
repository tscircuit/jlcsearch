import OpenAI from "openai"

export const getOpenAiClient = () => {
  const apiKey = process.env.OPENAI_API_KEY

  if (!apiKey) {
    throw new Error("Missing OPENAI_API_KEY environment variable")
  }

  const baseURL = process.env.OPENAI_BASE_URL?.trim()

  return new OpenAI({
    apiKey,
    baseURL: baseURL && baseURL.length > 0 ? baseURL : undefined,
  })
}
