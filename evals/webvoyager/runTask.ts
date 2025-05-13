import { startAgent } from '../../packages/magnitude-core/src/agent/agent';
import * as fs from 'fs';
import * as readline from 'readline';
import * as path from 'path';

interface Task {
    web_name: string;
    id: string;
    ques: string;
    web: string;
}

async function findTaskById(filePath: string, taskId: string): Promise<Task | null> {
    const fileStream = fs.createReadStream(filePath);
    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity,
    });

    for await (const line of rl) {
        try {
            const task: Task = JSON.parse(line);
            if (task.id === taskId) {
                return task;
            }
        } catch (error) {
            console.error('Error parsing JSON line:', error);
        }
    }
    return null;
}

async function runTask(taskId: string) {
    const tasksFilePath = path.join(__dirname, 'tasks.jsonl');
    const task = await findTaskById(tasksFilePath, taskId);

    if (!task) {
        console.error(`Task with ID "${taskId}" not found in ${tasksFilePath}.`);
        return;
    }

    console.log(`Running task: ${task.id} - ${task.ques}`);
    console.log(`URL: ${task.web}`);

    const agent = await startAgent({ url: task.web });

    await agent.act(task.ques);

    await agent.stop();
    console.log(`Finished task: ${task.id}`);
}

async function main() {
    const taskId = process.argv[2];
    if (!taskId) {
        console.error('Please provide a task ID as a command-line argument.');
        console.log('Example: bun evals/webvoyager/runTask.ts Allrecipes--0');
        // Optionally, run a default task or list available tasks
        // For now, let's run a default task if no ID is provided for testing
        // await runTask('Allrecipes--0'); 
        return;
    }
    await runTask(taskId);
}

main().catch(console.error);
