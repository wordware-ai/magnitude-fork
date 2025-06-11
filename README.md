<div align="center">
  <p>
    <img src="https://magnitude.run/logo.svg" alt="Magnitude Logo" width="100" style="vertical-align: middle; margin-right: 20px" />
  </p>

  <h3 align="center">
    Magnitude: The open source, AI-native testing framework for web apps
  </h3>

  <p>
    <a href="https://discord.gg/VcdpMh9tTy" target="_blank"><img src="https://img.shields.io/discord/1305570963206836295?style=flat-square&color=5865F2&logo=discord&logoColor=white&label=Discord" alt="Discord" /></a> <a href="https://magnitude.run/" target="_blank"><img src="https://img.shields.io/badge/Homepage-blue?style=flat-square&logo=homebridge&logoColor=white" alt="Homepage" /></a> <a href="https://docs.magnitude.run/getting-started/introduction" target="_blank"><img src="https://img.shields.io/badge/Docs-blue?style=flat-square&logo=readthedocs&logoColor=white" alt="Documentation" /></a> <img src="https://img.shields.io/github/license/magnitudedev/magnitude?style=flat-square" alt="License" /> <a href="https://x.com/tgrnwld" target="_blank"><img src="https://img.shields.io/badge/follow-%40tgrnwld-000000?style=flat-square&logo=x&logoColor=white" alt="Follow @tgrnwld" /></a> <a href="https://x.com/ndrsrkl" target="_blank"><img src="https://img.shields.io/badge/follow-%40ndrsrkl-000000?style=flat-square&logo=x&logoColor=white" alt="Follow @ndrsrkl" /></a>
  </p>

  <hr style="height: 1px; border: none; background-color: #e1e4e8; margin: 24px 0;">
</div>

End-to-end testing framework powered by visual AI agents that see your interface and adapt to any changes in it.

## How it works
- ✍️ Build test cases easily with natural language
- 🧠 Strong reasoning agent to plan and adjust tests
- 👁️ Fast visual agent to reliably execute runs
- 📄 Plan is saved to execute runs the same way
- 🛠 Reasoning agent steps in if there is a problem
- 🏃‍♂️ Run tests locally or in CI/CD pipelines

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

## Setup

### Install Magnitude
**1. Install our test runner** in the node project you want to test (or see our [demo repo](https://github.com/magnitudedev/magnitude-demo-repo) if you don't have a project to try it on)
```sh
npm install --save-dev magnitude-test
```

**2. Setup Magnitude** in your project by running:
```sh
npx magnitude init
```
This will create a basic tests directory `tests/magnitude` with:
- `magnitude.config.ts`: Magnitude test configuration file
- `example.mag.ts`: An example test file

**3. Configure an LLM**

The easiest way to set up an LLM for Magnitude is to set the `ANTHROPIC_API_KEY` environment variable. Sonnet 4 will be used by default. See [Compatible LLMS](#compatible-llms) for more details.

🚀 Now you're ready to run tests!


## Running tests

**Run your Magnitude tests with:**
```sh
npx magnitude
```

This will run all Magnitude test files discovered with the `*.mag.ts` pattern. If the agent finds a problem with your app, it will tell you what happened and describe the bug!

> To run many tests in parallel, add `-w <workers>`


## Building test cases

Now that you've got Magnitude set up, you can create real test cases for your app. Here's an example for a general idea:
```ts
import { test } from 'magnitude-test';

test('can log in and create company', async (agent) => {
    await agent.act('Log in to the app', {
        data: { username: 'test-user@magnitude.run', password: 'test' }
    });
    await agent.check('Can see dashboard');
    await agent.act('Create a new company', { data: 'Make up the first 2 values and use defaults for the rest' });
    await agent.check('Company added successfully');
});
```

Act, checks, and data are all natural language. Think of it like you're describing how to test a particular flow to a co-worker - what steps they need to take, what they should check for, and what test data to use.

For more information on how to build test cases see <a href="https://docs.magnitude.run/core-concepts/building-test-cases" target="_blank">our docs.</a>

## Compatible LLMs

Magnitude requires a **grounded** LLM - one that knows the precise coordinates of elements on a screen. Only a few meet this requirement. We recommend Anthropic's Sonnet 4. To use Sonnet, simply set `ANTHROPIC_API_KEY` in your environment.

Another strong grounded model that happens to be open source is `qwen2.5-vl-72b-instruct`. It is available through inference providers such as [OpenRouter](https://openrouter.ai/qwen/qwen2.5-vl-72b-instruct). If `ANTHROPIC_API_KEY` is not set but`OPENROUTER_API_KEY` is available, qwen2.5-vl-72b will automatically be used.

## Integrating with CI/CD
You can run Magnitude tests in CI anywhere that you could run Playwright tests, just include LLM client credentials. For instructions on running tests cases on GitHub actions, see [here](https://docs.magnitude.run/integrations/github-actions).

## FAQ

### Why not OpenAI Operator / Claude Computer Use?
We use separate planning / execution models in order to plan effective tests while executing them quickly and reliably. OpenAI or Anthropic's Computer Use APIs are better suited to general purpose desktop/web tasks but lack the speed, reliability, and cost-effectiveness for running test cases. Magnitude's agent is designed from the ground up to plan and execute test cases, and provides a native test runner purpose-built for designing and running these tests.

## Contact

To get a personalized demo or see how Magnitude can help your company, feel free to reach out to us at founders@magnitude.run

You can also join our <a href="https://discord.gg/VcdpMh9tTy" target="_blank">Discord community</a> for help or any suggestions!
