#!/usr//bin/env node

import { program } from "commander";
import { execSync } from "child_process";
import fs from "fs-extra";
import path from "path";
import os from "os";
import inquirer from "inquirer";

const REPO_URL = "https://github.com/magnitudedev/magnitude-scaffold";

interface ProjectInfo {
    projectName: string;
};

async function establishProjectInfo(info: Partial<ProjectInfo>): Promise<ProjectInfo> {
    const answers = await inquirer.prompt([
        {
            type: "input",
            name: "projectName",
            message: "Enter a name for your project",
            when: () => !info.projectName,
            validate: (input: string) => {
                if (!input.trim()) {
                return "Project name cannot be empty";
                }
                return true;
            },
        },
    ]);
    console.log(answers);
    return answers as ProjectInfo;
}

async function createProject(project: ProjectInfo) {
    console.log(`Creating a new project in ./${project.projectName}...`);

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
        console.log(`Cloning template from ${REPO_URL}...`);
        execSync(
            `git clone --depth 1 -b ${REPO_BRANCH} ${REPO_URL} ${tempDir}`,
            { stdio: "ignore" }
        );

        fs.copySync(tempDir, projectDir);
        console.log("Template copied successfully.");

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

        console.log("\nProject setup complete!");
        console.log("Next steps:");
        console.log(`  cd ${project.projectName}`);
        console.log("  npm install");
        console.log("  npm start");
    } catch (error) {
        console.error("\nAn error occurred while creating the project:");
        console.error(error);
        fs.rmSync(projectDir, { recursive: true, force: true });
        process.exit(1);
    } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
    }
}



program
    .name("create-my-app")
    .description("Create a new project from a template.")
    .argument("[project-name]", "The name for the new project.")
    //.option('-n, --name', 'project name')
    .action(async (projectName) => {
        const projectInfo = await establishProjectInfo({ projectName });
        createProject(projectInfo);
    })
    .parse(process.argv);