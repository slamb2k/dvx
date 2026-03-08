import { createClient } from '../client/create-client.js'
import { validateGuid } from '../utils/validation.js'
import { promptConfirm } from '../utils/confirm.js'

interface DeleteOptions {
  confirm: boolean
  dryRun: boolean
}

export async function deleteRecord(entityName: string, id: string, options: DeleteOptions): Promise<void> {
  validateGuid(id)

  if (!options.confirm && process.stdout.isTTY) {
    const confirmed = await promptConfirm(`Delete record '${id}' from '${entityName}'?`)
    if (!confirmed) {
      console.error('Aborted')
      return
    }
  }

  const { client } = await createClient({ dryRun: options.dryRun })
  await client.deleteRecord(entityName, id)
  console.error('Record deleted successfully')
}
