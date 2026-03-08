export type Shell = 'bash' | 'zsh' | 'powershell';

const COMMANDS = ['auth', 'entities', 'schema', 'query', 'get', 'create', 'update', 'upsert', 'delete', 'batch', 'action', 'mcp', 'init', 'completion'];

const BASH_COMPLETION = `
# dvx bash completion
_dvx_completion() {
  local cur prev words
  COMPREPLY=()
  cur="\${COMP_WORDS[COMP_CWORD]}"
  prev="\${COMP_WORDS[COMP_CWORD-1]}"

  local commands="${COMMANDS.join(' ')}"
  local auth_commands="create select login list"

  case "\${prev}" in
    dvx) COMPREPLY=($(compgen -W "\${commands}" -- "\${cur}")) ;;
    auth) COMPREPLY=($(compgen -W "\${auth_commands}" -- "\${cur}")) ;;
    completion) COMPREPLY=($(compgen -W "bash zsh powershell" -- "\${cur}")) ;;
    *) COMPREPLY=($(compgen -f -- "\${cur}")) ;;
  esac
}
complete -F _dvx_completion dvx
`.trim();

const ZSH_COMPLETION = `
#compdef dvx
_dvx() {
  local state
  _arguments \\
    '1: :->cmd' \\
    '*: :->args'
  case \$state in
    cmd) _values 'commands' ${COMMANDS.join(' ')} ;;
    args) case \$words[2] in
      auth) _values 'auth commands' create select login list ;;
      completion) _values 'shells' bash zsh powershell ;;
    esac ;;
  esac
}
_dvx "\$@"
`.trim();

const POWERSHELL_COMPLETION = `
Register-ArgumentCompleter -Native -CommandName dvx -ScriptBlock {
  param(\$wordToComplete, \$commandAst, \$cursorPosition)
  \$commands = @(${COMMANDS.map(c => `'${c}'`).join(',')})
  \$commands | Where-Object { \$_ -like "\${wordToComplete}*" } | ForEach-Object {
    [System.Management.Automation.CompletionResult]::new(\$_, \$_, 'ParameterValue', \$_)
  }
}
`.trim();

export function completion(shell: Shell): void {
  switch (shell) {
    case 'bash': console.log(BASH_COMPLETION); break;
    case 'zsh': console.log(ZSH_COMPLETION); break;
    case 'powershell': console.log(POWERSHELL_COMPLETION); break;
  }
}
