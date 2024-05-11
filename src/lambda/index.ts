import 'source-map-support/register'
import 'reflect-metadata'
import { Container } from 'typedi'
import { S3Client } from '@aws-sdk/client-s3'
import { JokeGenerator } from '../business/joke-generator'
import { Configuration, OpenAIApi } from 'openai'
import { GoogleGenerativeAI } from '@google/generative-ai'


Container.set('S3_CLIENT', new S3Client({ region: 'eu-west-1' }))
Container.set('S3_BUCKET', process.env.BUCKET)

async function handler(event: any, context: any) {
  console.log(`Started processing...\nPayload: ${JSON.stringify({ event, context }, null, 2)}`)

  Container.set('OPEN_AI_CLIENT', new OpenAIApi(new Configuration({
    apiKey: process.env.OPENAI_API_KEY as string,
  })))
  Container.set('GOOGLE_AI_CLIENT', new GoogleGenerativeAI(process.env.GOOGLE_API_KEY as string))

  const jokeGenerator = Container.get(JokeGenerator)
  const response = await jokeGenerator.generate()

  return {
    statusCode: 200,
    body: JSON.stringify(response),
  }
}

export { handler }
