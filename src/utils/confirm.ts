import * as readline from 'node:readline'

export async function promptConfirm(
  message: string,
  input?: NodeJS.ReadableStream,
  output?: NodeJS.WritableStream,
): Promise<boolean> {
  if (!process.stdout.isTTY) {
    return false
  }

  const rl = readline.createInterface({
    input: input ?? process.stdin,
    output: output ?? process.stdout,
  })

  return new Promise<boolean>((resolve) => {
    rl.question(`${message} (y/N) `, (answer) => {
      rl.close()
      resolve(answer.toLowerCase() === 'y')
    })
  })
}
