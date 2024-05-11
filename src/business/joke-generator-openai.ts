import { Inject, Service } from 'typedi'
import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { OpenAIApi } from 'openai'
const text2Svg = require('text-svg')

@Service()
export class JokeGenerator {
  constructor(
    @Inject('S3_CLIENT') private readonly s3Client: S3Client,
    @Inject('S3_BUCKET') private readonly s3Bucket: string,
    @Inject('OPEN_AI_CLIENT') private readonly openai: OpenAIApi,
  ) {}

  async generate() {
    const existingResponse = await this.s3Client.send(new GetObjectCommand({
      Key: `joke.json`,
      Bucket: this.s3Bucket,
    }))
    let existing = JSON.parse(await existingResponse.Body?.transformToString() || '[]')

    let input = {
      model: "gpt-3.5-turbo",
      messages: [
        {role: "user", content: "Make a joke about software engineering."},
      ]
    } as any
    if (existing.length > 0) {
      if (existing.length > 20) {
        existing = existing.slice(20)
      }
      const examples = existing.map((e: any) => `- ${e}\n`).join('')
      input.messages.push(
        {role: "user", content: `Some examples:\n${examples}`}
      )
    }
    console.log(JSON.stringify(input, null, 2))

    const response = await this.openai.createChatCompletion(input)
    const generated = response.data.choices[0].message?.content || ''

    existing.push(generated)
    await this.s3Client.send(new PutObjectCommand({
      Body: JSON.stringify(existing),
      Key: `joke.json`,
      Bucket: this.s3Bucket,
      ContentType: "application/json",
    }))

    console.log('Generated response: ' + generated)
    const svg = text2Svg(generated)

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
