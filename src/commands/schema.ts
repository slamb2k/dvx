import { createClient } from '../client/create-client.js'

interface SchemaOptions {
  output: 'json'
  noCache: boolean
}

export async function schema(entityName: string, options: SchemaOptions): Promise<void> {
  const { client } = await createClient()

  const entry = await client.getEntitySchema(entityName, options.noCache)

  console.log(JSON.stringify(entry, null, 2))
}
