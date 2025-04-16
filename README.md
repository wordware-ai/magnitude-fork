<div align="center">
  <p>
    <img src="https://magnitude.run/logo.svg" alt="Magnitude Logo" width="100" style="vertical-align: middle; margin-right: 20px" />
  </p>

  <h3 align="center">
    Magnitude: Open source AI agents for web testing
  </h3>

  <p>
    <a href="https://discord.gg/VcdpMh9tTy" target="_blank"><img src="https://img.shields.io/discord/1305570963206836295?style=flat-square&color=5865F2&logo=discord&logoColor=white&label=Discord" alt="Discord" /></a> <a href="https://magnitude.run/" target="_blank"><img src="https://img.shields.io/badge/Homepage-blue?style=flat-square&logo=homebridge&logoColor=white" alt="Homepage" /></a> <a href="https://docs.magnitude.run/getting-started/introduction" target="_blank"><img src="https://img.shields.io/badge/Docs-blue?style=flat-square&logo=readthedocs&logoColor=white" alt="Documentation" /></a> <img src="https://img.shields.io/github/license/magnitudedev/magnitude?style=flat-square" alt="License" /> <a href="https://x.com/tgrnwld" target="_blank"><img src="https://img.shields.io/badge/follow-%40tgrnwld-000000?style=flat-square&logo=x&logoColor=white" alt="Follow @tgrnwld" /></a> <a href="https://x.com/ndrsrkl" target="_blank"><img src="https://img.shields.io/badge/follow-%40ndrsrkl-000000?style=flat-square&logo=x&logoColor=white" alt="Follow @ndrsrkl" /></a>
  </p>

  <hr style="height: 1px; border: none; background-color: #e1e4e8; margin: 24px 0;">
</div>

End-to-end testing framework powered by visual AI agents that see your interface and adapt to any changes in it.

Available as a [hosted service](#running-your-first-test) or you can [self-host](#self-hosting)!

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
test('can add and complete todos', { url: 'https://magnitodo.com' })
    .step('create 3 todos')
        .data('Take out the trash, Buy groceries, Build more test cases with Magnitude')
        .check('should see all 3 todos')
    .step('mark each todo complete')
        .check('says no items left')
```

## Running your first test

> To try Magnitude with zero setup, check out our [test playground](https://app.magnitude.run/signup?seedpg=true) 🛝

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

**3. Configure the Magnitude client**

For hosted, you just need a Magnitude API key. To use your own LLM providers and browser infra, see [self-hosting](#self-hosting).

You can get a free API key by signing up at <a href="https://app.magnitude.run/signup" target="_blank">app.magnitude.run/signup</a> in Settings -> API Keys. Then set the `MAGNITUDE_API_KEY` environment variable:
```sh
export MAGNITUDE_API_KEY=<your-api-key-here>
```

**4. Run your Magnitude tests with:**
```sh
npx magnitude
```

This will run all Magnitude test files discovered with the `*.mag.ts` pattern. Click the URL that pops up to view the test in the Magnitude dashboard! For more information see docs on [running tests](https://docs.magnitude.run/core-concepts/running-tests) or [CLI reference](https://docs.magnitude.run/reference/cli).

**5. Add your own test cases!**

Now that you've got Magnitude set up, you can create real test cases for your app. Here's an example for a general idea:
```ts
import { test } from 'magnitude-test';

test('can log in and create company')
    .step('Log in to the app')
        .data({ username: 'test-user@magnitude.run' }) // arbitrary key/values
        .secureData({ password: 'test' }) // sensitive data
        .check('Can see dashboard') // natural language assertion
    .step('Create a new company')
        .data('Make up the first 2 values and use defaults for the rest')
        .check('Company added successfully');
```

Steps, checks, and data are all natural language. Think of it like you're describing how to test a particular flow to a co-worker - what steps they need to take, what they should check for, and what test data to use.

For more information on how to build test cases see <a href="https://docs.magnitude.run/core-concepts/building-test-cases" target="_blank">our docs.</a>

## Self-hosting

We are commited to being open source and allowing developers to run Magnitude with their own browser infrastructure and LLM providers. Check out our [docs](https://docs.magnitude.run/advanced/self-hosting) for comprehensive self-hosting instructions.

## Self-hosted vs. Hosted

| Feature | Self-hosted | Hosted |
| --- | --- | --- |
| 🧪 Test framework (run AI tests anywhere!) | ✅ | ✅ |
| 🤖 Core agents (fully open source!) | ✅ | ✅ |
| 🌐 Managed browser infra (no Playwright needed!) | ❌ | ✅ |
| 🧠 Managed LLM infra (only need Magnitude API key!) | ❌ | ✅ |
| 🎮 Test playground (design and debug tests visually!) | ❌ | ✅ |
| 📊 Test Console (manage test cases + view past runs!) | ❌ | ✅ |
| 💸 Free tier + per-run <a href="https://magnitude.run/pricing" target="_blank">pricing</a> (simple + affordable!)  | ❌ | ✅ |

## FAQ

### Why not OpenAI Operator / Claude Computer Use?
We use separate planning / execution models in order to plan effective tests while executing them quickly and reliably. OpenAI or Anthropic's Computer Use APIs are better suited to general purpose desktop/web tasks but lack the speed, reliability, and cost-effectiveness for running test cases. Magnitude's agent is designed from the ground up to plan and execute test cases, and provides a native test runner purpose-built for designing and running these tests.

## Contact

To get a personalized demo or see how Magnitude can help your company, feel free to reach out to us at founders@magnitude.run

You can also join our <a href="https://discord.gg/VcdpMh9tTy" target="_blank">Discord community</a> for help or any suggestions!
