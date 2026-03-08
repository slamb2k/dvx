import { createClient } from '../client/create-client.js'
import { validateGuid } from '../utils/validation.js'
import { promptConfirm } from '../utils/confirm.js'
import { formatMutationResult } from '../utils/output.js'
import { ValidationError } from '../errors.js'
import { BaseMutationOptions } from './types.js'

interface DeleteOptions extends BaseMutationOptions {
  confirm?: boolean
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
