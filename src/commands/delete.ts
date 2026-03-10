import { createClient } from '../client/create-client.js'
import { validateEntityName, validateGuid } from '../utils/validation.js'
import { formatMutationResult } from '../utils/output.js'
import { ValidationError } from '../errors.js'
import { BaseMutationOptions } from './types.js'
import { isInteractive, promptConfirmClack, createSpinner, logMutationSuccess } from '../utils/cli.js'

interface DeleteOptions extends BaseMutationOptions {
  confirm?: boolean
}

export async function deleteRecord(entityName: string, id: string, options: DeleteOptions): Promise<void> {
  validateEntityName(entityName)
  validateGuid(id)

  if (!options.confirm && !options.dryRun) {
    if (isInteractive()) {
      const confirmed = await promptConfirmClack(`Delete record '${id}' from '${entityName}'?`)
      if (!confirmed) {
        process.stderr.write('Aborted\n')
        return
      }
    } else {
      throw new ValidationError('Non-interactive mode requires --confirm flag for delete operations')
    }
  }

  const { client } = await createClient({ dryRun: options.dryRun, callerObjectId: options.callerObjectId })

  const s = createSpinner()
  s.start(`Deleting ${entityName} ${id}...`)
  try {
    await client.deleteRecord(entityName, id)
  } catch (err) {
    s.error('Delete failed')
    throw err
  }
  s.stop(`Deleted ${entityName}`)
  logMutationSuccess(`Deleted ${id} from ${entityName}`)
  formatMutationResult(null, { format: options.output ?? 'table' })
}
