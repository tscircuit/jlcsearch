import OpenAI from "openai"

export const getOpenAiClient = () => {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured")
  }
  return new OpenAI({
    apiKey,
  })
}
