// CLI argument parser — extracted so tests can import parseArgs without
// triggering the top-level main() call in cli.ts.

export interface CliOpts {
  prompt?: string;
  scripted?: boolean;
  cwd?: string;
  verbose?: boolean;
  config?: boolean;
  configKey?: string;
  configVal?: string;
  configGet?: boolean;
  update?: boolean;
  historyClear?: boolean;
  webSearch?: boolean;
  webExtract?: boolean;
  auth?: boolean;
  authAction?: "login" | "logout" | "list";
  authProvider?: string;
  authKey?: string;
  modelsList?: boolean;
  modelsSelect?: boolean;
  modelsSet?: string;
  eval?: boolean;
  evalSuite?: string;
  evalModel?: string;
  evalCompare?: string;
  evalJudge?: string;
  version?: boolean;
  status?: boolean;
  doctor?: boolean;
  jsonMode?: boolean;
  sessionAction?: "save" | "load" | "list" | "export";
  sessionName?: string;
  init?: boolean;
  dashboard?: boolean;
  tui?: boolean;
  submitTask?: string;
  submitResult?: string;
  sandboxTool?: boolean;
  learnTarget?: string;  // URL or file path for `helix learn`
}

export function parseArgs(argv: string[]): CliOpts {
  const opts: CliOpts = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "-p" || a === "--prompt") opts.prompt = argv[++i];
    else if (a === "--scripted") opts.scripted = true;
    else if (a === "-v" || a === "--verbose") opts.verbose = true;
    else if (a === "-V" || a === "--version") opts.version = true;
    else if (a === "status") opts.status = true;
    else if (a === "doctor") opts.doctor = true;
    else if (a === "session") {
      opts.sessionAction = (argv[++i] as any) ?? "list";
      opts.sessionName = argv[i + 1] && !argv[i + 1].startsWith("-") ? argv[++i] : undefined;
    }
    else if (a === "init") opts.init = true;
    else if (a === "--json") opts.jsonMode = true;
    else if (a === "dashboard") opts.dashboard = true;
    else if (a === "tui") opts.tui = true;
    else if (a === "-c" || a === "--cwd") opts.cwd = argv[++i];
    else if (a === "config") {
      opts.config = true;
      const sub = argv[++i];
      if (sub === "set") {
        opts.configKey = argv[++i];
        opts.configVal = argv[++i];
      } else if (sub === "get") {
        opts.configGet = true;
        opts.configKey = argv[++i];
      } else if (sub === "list") {
        opts.configGet = true;
      }
    }
    else if (a === "submit-task") {
      opts.submitTask = argv[++i];
      opts.submitResult = argv[++i];
    }
    else if (a === "--sandbox") {
      opts.sandboxTool = true;
    }
    else if (a === "update") opts.update = true;
    else if (a === "learn") {
      opts.learnTarget = argv[++i]; // next arg is URL or file path
    }
    else if (a === "auth") {
      opts.auth = true;
      const sub = argv[++i];
      if (sub === "login") {
        opts.authAction = "login";
        opts.authProvider = argv[++i];
        const next = argv[i + 1];
        if (next && next !== "--key" && !next.startsWith("-")) opts.authKey = argv[++i];
        if (argv[i + 1] === "--key") { i++; opts.authKey = argv[++i]; }
      } else if (sub === "logout") {
        opts.authAction = "logout";
        opts.authProvider = argv[++i];
      } else if (sub === "list" || sub === "ls" || sub === undefined) {
        opts.authAction = "list";
      }
    }
    else if (a === "history" && argv[i + 1] === "clear") {
      opts.historyClear = true;
      i++;
    }
    else if (a === "models") {
      const sub = argv[i + 1];
      if (sub === "select" || sub === "set") {
        opts.modelsSelect = true;
        if (sub === "set" && argv[i + 2] && !argv[i + 2].startsWith("-")) {
          opts.modelsSet = argv[i + 2];
        }
      } else {
        opts.modelsList = true;
      }
    }
    else if (a === "eval") {
      opts.eval = true;
      let j = i + 1;
      while (argv[j] && argv[j].startsWith("--")) {
        if (argv[j] === "--suite" && argv[j + 1]) opts.evalSuite = argv[++j];
        else if (argv[j] === "--model" && argv[j + 1]) opts.evalModel = argv[++j];
        else if (argv[j] === "--compare" && argv[j + 1]) opts.evalCompare = argv[++j];
        else if (argv[j] === "--judge" && argv[j + 1]) opts.evalJudge = argv[++j];
        j++;
      }
      i = j - 1;
    }
    else if (a === "--web") opts.webSearch = opts.webExtract = true;
    else if (a === "--web-search") opts.webSearch = true;
    else if (a === "--web-extract") opts.webExtract = true;
  }
  return opts;
}
