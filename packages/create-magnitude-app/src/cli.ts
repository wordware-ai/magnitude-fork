#!/usr//bin/env node

import { program } from "commander";
import { execSync } from "child_process";
import fs from "fs-extra";
import path from "path";
import os from "os";
import { bold, blueBright, greenBright, gray } from "ansis";
import { intro, outro, spinner, log, text, select, confirm, isCancel } from '@clack/prompts';
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
    apiKey: string
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
    }

    //return {...info, ...answers} as ProjectInfo;
    return { projectName, model, provider, apiKey: apiKey! }
}

async function createProject(project: ProjectInfo) {
    //console.log(`Creating a new project in ./${project.projectName}...`);

    const projectDir = path.resolve(process.cwd(), project.projectName);
    const tempDir = path.join(
        os.tmpdir(),
        "scaffold-clone-" + Math.random().toString(36).substr(2, 9)
    );

    if (fs.existsSync(projectDir)) {
        console.error(`Error: Directory ${project.projectName} already exists.`);
        process.exit(1);
    }

    try {
        //console.log(`Cloning template from ${REPO_URL}...`);
        execSync(
            `git clone --depth 1 -b ${REPO_BRANCH} ${REPO_URL} ${tempDir}`,
            { stdio: "ignore" }
        );

        fs.copySync(tempDir, projectDir);
        //console.log("Template copied successfully.");

        const gitDir = path.join(projectDir, ".git");
        if (fs.existsSync(gitDir)) {
            fs.rmSync(gitDir, { recursive: true, force: true });
        }
        execSync("git init", { stdio: "ignore", cwd: projectDir });

        const packageJsonPath = path.join(projectDir, "package.json");
        if (fs.existsSync(packageJsonPath)) {
            const packageJson = fs.readJsonSync(packageJsonPath);
            packageJson.name = project.projectName;
            fs.writeJsonSync(packageJsonPath, packageJson, { spaces: 2 });
        }

        // console.log("\nProject setup complete!");
        // console.log(blueBright`Next steps:`);
        // console.log(`  cd ${project.projectName}`);
        // console.log("  npm install");
        // console.log("  npm start");
    } catch (error) {
        log.error("\nAn error occurred while creating the project:");
        log.error((error as Error).message);
        fs.rmSync(projectDir, { recursive: true, force: true });
        process.exit(1);
    } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
    }
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
        
        console.log(bold(blueBright`${title}`));

        intro('create-magnitude-app');
        const projectInfo = await establishProjectInfo({ projectName });

        // const s = spinner();
        // s.start('Cloning project template');

        // s.stop('Project template cloned');
        //outro('Time to build browser automations!');
        const createProjectSpinner = spinner();
        createProjectSpinner.start('Creating project');
        const projectDir = await createProject(projectInfo);
        createProjectSpinner.stop(`Project created in ${projectDir}`);
        outro(`You're all set!`);
        // boxen(`Next steps:\n  cd ${projectName}\n  npm install\n  npm run`
        console.log(boxen(`cd ${projectInfo.projectName}\nnpm install\nnpm run`, { padding: 1, margin: 1, title: 'Next steps', borderStyle: 'round', borderColor: 'blueBright'}));
    })
    .parse(process.argv);