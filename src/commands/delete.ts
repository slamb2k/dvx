import { createClient } from '../client/create-client.js'
import { validateGuid } from '../utils/validation.js'
import { promptConfirm } from '../utils/confirm.js'
import { formatMutationResult, type OutputFormat } from '../utils/output.js'
import { ValidationError } from '../errors.js'

interface DeleteOptions {
  confirm: boolean
  dryRun: boolean
  callerObjectId?: string
  output?: OutputFormat
}

export async function deleteRecord(entityName: string, id: string, options: DeleteOptions): Promise<void> {
  validateGuid(id)

  if (!options.confirm) {
    if (process.stdout.isTTY) {
      const confirmed = await promptConfirm(`Delete record '${id}' from '${entityName}'?`)
      if (!confirmed) {
        console.error('Aborted')
        return
      }
    } else {
      throw new ValidationError('Non-interactive mode requires --confirm flag for delete operations')
    }
  }

  const { client } = await createClient({ dryRun: options.dryRun, callerObjectId: options.callerObjectId })
  await client.deleteRecord(entityName, id)
  formatMutationResult(null, { format: options.output ?? 'table' })
}
