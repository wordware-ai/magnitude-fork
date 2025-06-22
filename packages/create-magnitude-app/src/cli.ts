#!/usr//bin/env node

import { program } from "commander";
import { execSync } from "child_process";
import fs from "fs-extra";
import path from "path";
import os from "os";
import { bold, blueBright, greenBright, gray } from "ansis";
import { intro, outro, spinner, log, text, select, confirm, isCancel, multiselect } from '@clack/prompts';
import boxen from "boxen";

const REPO_URL = "https://github.com/magnitudedev/magnitude-scaffold";
const REPO_BRANCH = "main";


const title = String.raw`
 __  __                    _ _             _      
|  \/  | __ _  __ _ _ __  (_) |_ _   _  __| | ___ 
| |\/| |/ _' |/ _' | '_ \ | | __| | | |/ _' |/ _ \
| |  | | (_| | (_| | | | || | |_| |_| | (_| |  __/
|_|  |_|\__,_|\__, |_| |_||_|\__|\__,_|\__,_|\___|
              |___/                              
`;

interface ProjectInfo {
    projectName: string;
    model: 'claude' | 'qwen',
    provider: 'anthropic' | 'openrouter',
    apiKey: string,
    assistants: ('cursor' | 'claudecode' | 'cline' | 'windsurf')[]
    // assistants: {
    //     cursor: boolean,
    //     cline: boolean,
    //     windsurf: boolean
    // }
    //assistant: 'cursor' | 'cline' | 'windsurf' | null
};

async function establishProjectInfo(info: Partial<ProjectInfo>): Promise<ProjectInfo> {

    const projectName = info.projectName ? info.projectName : await text({
        message: 'What should your project be called?',
        placeholder: 'my-awesome-browser-app',
        validate(value) {
            if (value.trim().length === 0) return "Project name cannot be empty";

            const projectDir = path.resolve(process.cwd(), value);

            if (fs.existsSync(projectDir)) {
                return `Directory ${projectDir} already exists`;
            }
        }
    });
    if (isCancel(projectName)) {
        log.warn("Come back soon!");
        process.exit(0);
    }
    
    let model;
    while (true) {
        model = await select({
            message: 'What model would you like to use?',
            options: [
                { value: 'claude', label: 'Claude Sonnet 4 (Recommended)' },
                { value: 'qwen', label: 'Qwen 2.5 VL 72B' },
                { value: 'docs', label: 'Why only these models?' }
            ]
        });

        if (isCancel(model)) {
            log.warn("Didn't like the model selection? Only larger 'visually grounded' models work with Magnitude");
            log.message("See docs for details: https://docs.magnitude.run/customizing/llm-configuration");
            process.exit(0);
        }

        if (model === 'docs') {
            log.warn("Only larger 'visually grounded' models work with Magnitude");
            log.message("See docs for details: https://docs.magnitude.run/customizing/llm-configuration");
        } else {
            break;
        }
    }

    let provider: 'anthropic' | 'openrouter' | undefined;
    let apiKey: string | undefined;

    if (model === 'claude') {
        // Look for ANTHROPIC_API_KEY
        // if (process.env.ANTHROPIC_API_KEY) {
        //     await confirm({ message: 'Detected an ANTHROPIC_API_KEY. Use that?' });
        // }
        if (process.env.ANTHROPIC_API_KEY) {
            log.info(gray`Detected ANTHROPIC_API_KEY, using that`);
            provider = 'anthropic';
            apiKey = process.env.ANTHROPIC_API_KEY//`ANTHROPIC_API_KEY=${process.env.ANTHROPIC_API_KEY}`;
        }
        else if (process.env.OPENROUTER_API_KEY) {
            let useOpenRouter = await confirm({ message: 'Detected OPENROUTER_API_KEY, use Claude via OpenRouter?' });
            if (isCancel(useOpenRouter)) {
                useOpenRouter = false;
            }
            if (useOpenRouter) {
                provider = 'openrouter';
                apiKey = process.env.OPENROUTER_API_KEY
            }
        }
        if (!provider) {
            provider = 'anthropic';
            const key = await text({
                message: 'Please provide a valid ANTHROPIC_API_KEY',
                placeholder: 'sk-ant-...',
                validate(value) {
                    if (value.trim().length === 0) return "API key cannot be empty";
                }
            });
            if (isCancel(key)) {
                log.warn("Come back soon!");
                process.exit(0);
            }
            apiKey = key;
        }
    } else {
        if (process.env.OPENROUTER_API_KEY) {
            log.info(gray`Detected OPENROUTER_API_KEY, using that`);
            provider = 'openrouter';
            apiKey = process.env.OPENROUTER_API_KEY
        }
        if (!provider) {
            provider = 'openrouter';
            const key = await text({
                message: 'Please provide a valid OPENROUTER_API_KEY',
                placeholder: 'sk-or-...',
                validate(value) {
                    if (value.trim().length === 0) return "API key cannot be empty";
                }
            });
            if (isCancel(key)) {
                log.warn("Come back soon!");
                process.exit(0);
            }
            apiKey = key;
        }
    }

    let assistants = await multiselect({
        message: 'Are you using any code assistants?',
        options: [
            { value: 'claudecode', label: 'Claude Code' }, // claude.md
            { value: 'cline', label: 'Cline' }, // .clinerules
            { value: 'cursor', label: 'Cursor' }, // .cursorrules
            { value: 'windsurf', label: 'Windsurf' } // .windsurfrules
        ],
        required: false
    });

    if (isCancel(assistants)) {
        assistants = [];
    }

    //return {...info, ...answers} as ProjectInfo;
    return { projectName, model, provider, apiKey: apiKey!, assistants };
}

async function createProject(tempDir: string, projectDir: string, project: ProjectInfo) {
    //console.log(`Creating a new project in ./${project.projectName}...`);
    fs.ensureDirSync(tempDir);

    //log.info(`temp dir ${tempDir} created`);

    // Make sure project dir is still available
    if (fs.existsSync(projectDir)) {
        throw new Error(`Directory ${project.projectName} already exists.`);
    }

    // Clone scaffold into temp dir
    execSync(
        `git clone --depth 1 -b ${REPO_BRANCH} ${REPO_URL} ${tempDir}`,
        { stdio: "ignore" }
    );

    //log.info(`temp dir ${tempDir} cloned`);

    // === Configure scaffold project ===
    // Remove existing git in scaffold and init git
    const gitDir = path.join(tempDir, ".git");
    if (fs.existsSync(gitDir)) {
        fs.rmSync(gitDir, { recursive: true, force: true });
    }
    execSync("git init", { stdio: "ignore", cwd: tempDir });

    // Configure package name
    const packageJsonPath = path.join(tempDir, "package.json");
    if (fs.existsSync(packageJsonPath)) {
        const packageJson = fs.readJsonSync(packageJsonPath);
        packageJson.name = project.projectName;
        fs.writeJsonSync(packageJsonPath, packageJson, { spaces: 2 });
    }

    // Configure assistant files
    const assistantMarkdown = fs.readFileSync(path.join(tempDir, '.cursorrules'), 'utf-8');
    for (const assistant of project.assistants) {
        if (assistant === 'cursor') {
            continue;
        } else if (assistant === 'cline') {
            fs.writeFileSync(path.join(tempDir, '.clinerules'), assistantMarkdown);
        } else if (assistant === 'claudecode') {
            fs.writeFileSync(path.join(tempDir, 'claude.md'), assistantMarkdown);
        } else if (assistant === 'windsurf') {
            fs.writeFileSync(path.join(tempDir, '.windsurfrules'), assistantMarkdown);
        }
    }
    if (!(project.assistants.includes('cursor'))) {
        fs.rmSync(path.join(tempDir, '.cursorrules'));
    }

    // Configure LLM client via codegen

    let clientSnippet;
    if (project.provider === 'anthropic') {
        const model = 'claude-sonnet-4-20250514';
        clientSnippet=`llm: {
            provider: 'anthropic',
            options: {
                model: '${model}',
                apiKey: process.env.ANTHROPIC_API_KEY
            }
        }`;
    } else {
        const model = project.model === 'claude' ? 'anthropic/claude-sonnet-4' : 'qwen/qwen2.5-vl-72b-instruct';
        clientSnippet=`llm: {
            provider: 'openai-generic',
            options: {
                baseUrl: 'https://openrouter.ai/api/v1',
                model: '${model}',
                apiKey: process.env.OPENROUTER_API_KEY
            }
        }`;
    }
    // Replace code
    const code = fs.readFileSync(path.join(tempDir, 'src', 'index.ts'), 'utf-8')
    const newCode = code.replace(`url: 'https://news.ycombinator.com/show'`, `url: 'https://news.ycombinator.com/show',\n        ${clientSnippet}`);
    fs.writeFileSync(path.join(tempDir, 'src', 'index.ts'), newCode);

    // Configure .env with API key
    fs.writeFileSync(path.join(tempDir, '.env'), project.provider === 'anthropic' ? `ANTHROPIC_API_KEY=${project.apiKey}\n` : `OPENROUTER_API_KEY=${project.apiKey}\n`);

    // Finally, copy to project dir
    fs.copySync(tempDir, projectDir);

    return projectDir;
}

program
    .name("create-my-app")
    .description("Create a new project from a template.")
    .argument("[project-name]", "The name for the new project.")
    //.option('-n, --name', 'project name')
    .action(async (projectName) => {
        // console.log("process.argv:", process.argv);
        // console.log("project name:", projectName);
        
        if (process.stdout.columns >= 50) console.log(bold(blueBright`${title}`));

        intro('create-magnitude-app');
        const projectInfo = await establishProjectInfo({ projectName });
        //console.log(projectInfo);

        // const s = spinner();
        // s.start('Cloning project template');

        // s.stop('Project template cloned');
        //outro('Time to build browser automations!');
        const createProjectSpinner = spinner();
        createProjectSpinner.start('Creating project');

        const projectDir = path.resolve(process.cwd(), projectInfo.projectName);
        const tempDir = path.join(
            os.tmpdir(),
            "scaffold-clone-" + Math.random().toString(36).substr(2, 9)
        );

        try {
            await createProject(tempDir, projectDir, projectInfo);
        } catch (error) {
            log.error("\nAn error occurred while creating the project:");
            log.error((error as Error).message);
            fs.rmSync(tempDir, { recursive: true, force: true });
            fs.rmSync(projectDir, { recursive: true, force: true });
            process.exit(1);
        }
        createProjectSpinner.stop(`Project created in ${projectDir}`);
        outro(`You're all set!`);

        console.log(boxen(`cd ${projectInfo.projectName}\nnpm install\nnpm start`, { padding: 1, margin: 1, title: 'Next steps', borderStyle: 'round', borderColor: 'blueBright'}));
    })
    .parse(process.argv);