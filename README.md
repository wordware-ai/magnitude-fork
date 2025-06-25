<div align="center">
  <img src="assets/full-header.png" alt="Magnitude Text Logo" width="500"/>
</div>

<h1 align="center">
  The AI browser automation framework
</h1>

<p align="center">
  Magnitude uses vision AI to enable you to control your browser with natural language
</p>

<p align="center">
  <a href="https://docs.magnitude.run/getting-started/introduction" target="_blank"><img src="https://img.shields.io/badge/📕-Docs-0369a1?style=flat-square&labelColor=0369a1&color=gray" alt="Documentation" /></a> <img src="https://img.shields.io/badge/License-Apache%202.0-0369a1?style=flat-square&labelColor=0369a1&color=gray" alt="License" /> <a href="https://discord.gg/VcdpMh9tTy" target="_blank"><img src="https://img.shields.io/badge/Discord-22%20online-5865F2?style=flat-square&labelColor=5865F2&color=gray&logo=discord&logoColor=white" alt="Discord" /></a> <a href="https://x.com/tgrnwld" target="_blank"><img src="https://img.shields.io/badge/-Follow%20Tom!-000000?style=flat-square&labelColor=000000&color=gray&logo=x&logoColor=white" alt="Follow @tgrnwld" /></a>
</p>

<hr style="height: 1px; border: none; background-color: #e1e4e8; margin: 24px 0;">
Magnitude provides the following building blocks...

- 🧭 **Navigate** - Understands your interface and how to navigate through it
- 🖱️ **Interact** - Translates natural language instructions into concrete click, type, scroll, drag, etc. actions
- 🔍 **Extract** - Intelligently parses the page and extracts relevant data based on your instructions
- ✅ **Verify** - Using the built-in test runner, verifies that the correct actions have been taken


![Video showing Magnitude tests running in a terminal and agent taking actions in the browser](assets/demo.gif)

↕️ Magnitude test case in action! ↕️
```ts
test('can add and complete todos', { url: 'https://magnitodo.com' }, async (agent) => {
    await agent.act('create 3 todos', {
        data: 'Take out the trash, Buy groceries, Build more test cases with Magnitude'
    });
    await agent.check('should see all 3 todos');
    await agent.act('mark each todo complete');
    await agent.check('says 0 items left');
});
```

## Get started

> 🛝 Try it out right away in the [playground](https://pg.magnitude.run) (no signup required)!

Get up and running with one command:
```bash
npx create-magnitude-app
```

This will create a new project and walk you through the steps to initialize it with Magnitude. It will also create an example script that you can run right away!

If you would like to install the test runner in an existing node project, please run:
```bash
npm i --save-dev magnitude-test && npx magnitude init
```

This will create a basic tests directory `tests/magnitude` with:
- `magnitude.config.ts`: Magnitude test configuration file
- `example.mag.ts`: An example test file

For information on how to run tests and integrate into CI/CD see [here](https://docs.magnitude.run/core-concepts/running-tests).

> [!NOTE]
> By default, Magnitude will look for an `ANTHROPIC_API_KEY` environment variable and use Claude Sonnet 4. Magnitude requires a model that is good at instruction following/planning **and** visually grounded. See [docs](https://docs.magnitude.run/customizing/llm-configuration) for more information and alternative models.


## Why Magnitude?

❌ **Problem #1:** Most browser agents follow "high-level prompt + tools = work until done" - works for demos, not production  
✅ **Solution: Controllable & repeatable automation**
* Flexible abstraction levels (granular actions vs. flows)
* Custom actions + prompts at agent and action level
* Deterministic runs via native caching system

❌ **Problem #2:** Most browser agents draw numbered boxes around page elements - doesn't generalize well due to complex modern sites
✅ **Solution: Vision-first architecture**
* Visually grounded LLM specifies pixel coordinates
* True generalization independent of DOM structure
* Future-proof architecture for desktop apps, VMs, etc.

## Additional info

Please see [our docs](https://docs.magnitude.run/core-concepts/building-test-cases) for more information on how to best build Magnitude automations and test cases.

## Contact
If you are an enterprise and want more features or support, feel free to reach out to us at founders@magnitude.run or schedule a call [here](https://cal.com/tom-greenwald/30min) to discuss your needs.

You can also join our <a href="https://discord.gg/VcdpMh9tTy" target="_blank">Discord community</a> for help or any suggestions!
