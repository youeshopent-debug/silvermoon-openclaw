"""
browser-use Agent Wrapper for OpenClaw v2
Supports browser-use v0.12.6+
Accepts JSON task via stdin, returns JSON result via stdout.
"""
import json, sys, os, traceback
from browser_use import Agent
from browser_use.controller import Controller

def create_llm(provider: str, model: str, api_key: str | None = None) -> object:
    proxy = os.environ.get("HTTP_PROXY") or os.environ.get("http_proxy") or None
    if provider == "openai":
        from browser_use.llm.openai.chat import ChatOpenAI
        kwargs = {"model": model}
        if api_key: kwargs["api_key"] = api_key
        return ChatOpenAI(**kwargs)
    elif provider == "anthropic":
        from browser_use.llm.anthropic.chat import ChatAnthropic
        kwargs = {"model": model}
        if api_key: kwargs["api_key"] = api_key
        return ChatAnthropic(**kwargs)
    elif provider == "google":
        from browser_use.llm.google.chat import ChatGoogle
        kwargs = {"model": model}
        if api_key: kwargs["api_key"] = api_key
        return ChatGoogle(**kwargs)
    elif provider == "groq":
        from browser_use.llm.groq.chat import ChatGroq
        kwargs = {"model": model}
        if api_key: kwargs["api_key"] = api_key
        return ChatGroq(**kwargs)
    elif provider == "ollama":
        from browser_use.llm.ollama.chat import ChatOllama
        return ChatOllama(model=model)
    elif provider == "openrouter":
        from browser_use.llm.openai.chat import ChatOpenAI
        key = api_key or os.environ.get("OPENROUTER_API_KEY", "sk-or-v1-xxxx")
        return ChatOpenAI(model=model, api_key=key, base_url="https://openrouter.ai/api/v1")
    else:
        from browser_use.llm.openai.chat import ChatOpenAI
        return ChatOpenAI(model=model or "gpt-4o")

def main():
    try:
        raw = sys.stdin.read()
        if not raw:
            raw = sys.argv[1] if len(sys.argv) > 1 else "{}"
        args = json.loads(raw) if raw.strip().startswith("{") else {"task": raw.strip()}
    except Exception as e:
        print(json.dumps({"ok": False, "error": f"Failed to parse input: {e}"}))
        sys.exit(1)

    task = args.get("task", "")
    if not task:
        print(json.dumps({"ok": False, "error": "No task provided"}))
        sys.exit(1)

    provider = args.get("llm", "openai")
    model = args.get("model", "gpt-4o")
    api_key = args.get("api_key", None)
    use_vision = args.get("use_vision", True)
    max_steps = args.get("max_steps", 20)
    max_actions = args.get("max_actions_per_step", 3)
    generate_gif = args.get("generate_gif", False)

    import asyncio

    async def run():
        try:
            llm = create_llm(provider, model, api_key)
            controller = Controller()
            agent = Agent(
                task=task,
                llm=llm,
                controller=controller,
                use_vision=use_vision,
                max_actions_per_step=max_actions,
                max_failures=5,
                generate_gif=generate_gif,
            )
            history = await agent.run(max_steps=max_steps)
            result = history.final_result() if hasattr(history, "final_result") else str(history)
            actions = [str(a) for a in history.actions] if hasattr(history, "actions") else []
            output = {
                "ok": True,
                "result": result,
                "actions": actions,
                "steps": len(history.model_actions) if hasattr(history, "model_actions") else 0,
            }
            print(json.dumps(output, ensure_ascii=False))
        except Exception as e:
            print(json.dumps({
                "ok": False,
                "error": str(e),
                "traceback": traceback.format_exc()
            }, ensure_ascii=False))

    asyncio.run(run())

if __name__ == "__main__":
    main()
