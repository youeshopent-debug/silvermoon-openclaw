import browser_use
print("browser-use imported OK")
attrs = [a for a in dir(browser_use) if not a.startswith("_")]
print(f"attrs: {attrs}")
from browser_use.agent.service import Agent
print(f"Agent class: {Agent}")
print("ALL OK")
