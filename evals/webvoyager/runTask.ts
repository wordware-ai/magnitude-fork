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

async function getAllTasks(filePath: string): Promise<Task[]> {
    const tasks: Task[] = [];
    const fileStream = fs.createReadStream(filePath);
    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity,
    });

    for await (const line of rl) {
        try {
            const task: Task = JSON.parse(line);
            tasks.push(task);
        } catch (error) {
            console.error('Error parsing JSON line:', error);
        }
    }
    return tasks;
}

async function runTask(taskToRun: Task | string) {
    let task: Task | null = null;
    const tasksFilePath = path.join(__dirname, 'tasks.jsonl');

    if (typeof taskToRun === 'string') {
        task = await findTaskById(tasksFilePath, taskToRun);
    } else {
        task = taskToRun;
    }

    if (!task) {
        const id = typeof taskToRun === 'string' ? taskToRun : taskToRun.id;
        console.error(`Task with ID "${id}" not found in ${tasksFilePath}.`);
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
    const tasksFilePath = path.join(__dirname, 'tasks.jsonl');

    if (!taskId || taskId.toLowerCase() === 'random') {
        console.log(taskId ? 'Running a random task...' : 'No task ID provided, running a random task...');
        const allTasks = await getAllTasks(tasksFilePath);
        if (allTasks.length === 0) {
            console.error(`No tasks found in ${tasksFilePath}. Cannot run a random task.`);
            return;
        }
        const randomIndex = Math.floor(Math.random() * allTasks.length);
        const randomTask = allTasks[randomIndex];
        await runTask(randomTask);
    } else {
        await runTask(taskId);
    }
}

main().catch(console.error);
