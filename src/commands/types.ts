import { type OutputFormat } from '../utils/output.js'

export interface BaseMutationOptions {
  dryRun?: boolean;
  callerObjectId?: string;
  output?: OutputFormat;
  json?: string;
}
