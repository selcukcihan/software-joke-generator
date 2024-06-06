import { Inject, Service } from 'typedi'
import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai'
const text2Svg = require('text-svg')

@Service()
export class JokeGenerator {
  constructor(
    @Inject('S3_CLIENT') private readonly s3Client: S3Client,
    @Inject('S3_BUCKET') private readonly s3Bucket: string,
    @Inject('GOOGLE_AI_CLIENT') private readonly ai: GoogleGenerativeAI,
  ) {}

  async generate() {
    const existingResponse = await this.s3Client.send(new GetObjectCommand({
      Key: `joke.json`,
      Bucket: this.s3Bucket,
    }))
    let existing = JSON.parse(await existingResponse.Body?.transformToString() || '[]')

    const model = this.ai.getGenerativeModel({ model: 'gemini-1.5-pro-latest' })
  
    const generationConfig = {
      temperature: 1,
      topK: 0,
      topP: 0.95,
      maxOutputTokens: 8192,
    }
  
    const safetySettings = [
      {
        category: HarmCategory.HARM_CATEGORY_HARASSMENT,
        threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
      },
      {
        category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
        threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
      },
      {
        category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
        threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
      },
      {
        category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
        threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
      },
    ]
  
    const chat = model.startChat({
      generationConfig,
      safetySettings,
      history: [
      ],
    })

    let input = "Make a joke about software engineering."
    if (existing.length > 0) {
      if (existing.length > 20) {
        existing = existing.slice(20)
      }
      const examples = existing.map((e: any) => `- ${e}\n`).join('')
      input += `\nSome examples:\n${examples}`
    }
    console.log(JSON.stringify(input, null, 2))

    const result = await chat.sendMessage(input)
    const response = result.response
    const generated = response.text() || ''
    console.log(generated)

    existing.push(generated)
    await this.s3Client.send(new PutObjectCommand({
      Body: JSON.stringify(existing),
      Key: `joke.json`,
      Bucket: this.s3Bucket,
      ContentType: "application/json",
    }))

    const svg = text2Svg(generated, {
      backgroundColor: 'white',
      padding: 10,
    })

    await this.s3Client.send(new PutObjectCommand({
      CacheControl: "no-cache, no-store, must-revalidate",
      Expires: new Date(0),
      ContentType: "image/svg+xml",
      Body: svg,
      Key: `joke.svg`,
      Bucket: this.s3Bucket,
      ACL: 'public-read',
    }))
    return {
      generated,
    }
  }
}
