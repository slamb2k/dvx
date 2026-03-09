import { type OutputFormat } from '../utils/output.js'

export interface BaseMutationOptions {
  dryRun?: boolean | undefined;
  callerObjectId?: string | undefined;
  output?: OutputFormat | undefined;
  json?: string | undefined;
}
