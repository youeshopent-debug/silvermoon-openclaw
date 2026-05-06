const { spawn } = require("child_process");
const path = require("path");

const PY_SCRIPT = path.join(__dirname, "browser-use-agent.py");
const PROXY = process.env.HTTP_PROXY || process.env.http_proxy || "http://127.0.0.1:7890";

async function browserUse(task, options = {}) {
  const {
    llm = "openai",
    model = "gpt-4o",
    headless = true,
    timeout = 120,
    maxSteps = 20,
    debug = false,
  } = options;

  const input = JSON.stringify({ task, llm, model, headless, timeout, max_steps: maxSteps });

  return new Promise((resolve, reject) => {
    const proc = spawn("python", [PY_SCRIPT], {
      stdio: ["pipe", "pipe", "pipe"],
      env: {
        ...process.env,
        HTTP_PROXY: PROXY,
        http_proxy: PROXY,
        HTTPS_PROXY: PROXY,
        https_proxy: PROXY,
      },
    });

    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      proc.kill("SIGTERM");
      reject(new Error(`browser-use timed out after ${timeout}s`));
    }, timeout * 1000);

    proc.stdout.on("data", (chunk) => { stdout += chunk; });
    proc.stderr.on("data", (chunk) => { stderr += chunk; });

    proc.on("close", (code) => {
      clearTimeout(timer);
      if (debug && stderr) console.warn("[browser-use] stderr:", stderr);

      try {
        const result = JSON.parse(stdout);
        resolve(result);
      } catch {
        if (code !== 0) {
          resolve({ ok: false, error: `Process exited with code ${code}`, stderr: stderr.trim() });
        } else {
          resolve({ ok: false, error: "Failed to parse output", stdout: stdout.slice(0, 500), stderr: stderr.slice(0, 500) });
        }
      }
    });

    proc.on("error", (err) => {
      clearTimeout(timer);
      resolve({ ok: false, error: err.message });
    });

    proc.stdin.write(input);
    proc.stdin.end();
  });
}

async function browserOpen(url, options = {}) {
  return browserUse(`Navigate to ${url} and describe what you see on the page in detail.`, {
    maxSteps: 10,
    ...options,
  });
}

async function browserExtract(url, selector, options = {}) {
  return browserUse(`Go to ${url} and extract all text content from elements matching CSS selector "${selector}". Return the extracted text.`, {
    maxSteps: 15,
    ...options,
  });
}

async function browserSearch(query, options = {}) {
  return browserUse(`Search the web for "${query}" and return the top results with titles, URLs, and brief summaries.`, {
    maxSteps: 15,
    ...options,
  });
}

module.exports = { browserUse, browserOpen, browserExtract, browserSearch };
