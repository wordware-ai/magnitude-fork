import logger from '@/logger';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { execSync } from 'node:child_process';
import cuid2 from '@paralleldrive/cuid2';
import { TestFailure, TestState } from '@/runner/state';
import { PostHog } from 'posthog-node'
import { LLMClientIdentifier } from 'magnitude-core';
import { VERSION } from '@/version';
import { createHash } from 'crypto';

export const posthog = new PostHog(
    'phc_BTdnTtG68V5QG6sqUNGqGfmjXk8g0ePBRu9FIr9upNu',
    {
        host: 'https://us.i.posthog.com'
    }
);

const createId = cuid2.init({ length: 12 });

export interface TelemetryPayload {
	telemetryVersion: string, // telemetry payload version will prob be nice in the future
    packageVersion: string,
    codebase?: string, // unique value derived from git hash if available
	startedAt: number, // timestamp
	doneAt: number, // timestamp
    numSteps: number,
    numChecks: number,
	browserActionCount: number, // number of web actions taken
    modelUsage: {
        llm: LLMClientIdentifier,
        inputTokens: number,
        outputTokens: number,
        numCalls: number
    }[],
    passed: boolean,
    failure?: TestFailure
};

// For reference
export interface V1TelemetryPayload {
	version: string,
	userId: string,
	startedAt: number,
	doneAt: number,
	cached: boolean,
	testCase: {
		numSteps: number,
		numChecks: number
	},
	actionCount: number,
	macroUsage: {
		provider: string,
		model: string,
		inputTokens: number,
		outputTokens: number,
		numCalls: number
	}
	microUsage: {
		provider: string,
		numCalls: number
	},
	result: string // e.g. 'passed' | 'bug' | 'misalignment'
};


export async function sendTelemetry(state: TestState) {
    // const fullPayload: V1TelemetryPayload = {
    //     version: '0.1',
    //     userId: getMachineId(),
    //     ...payload
    // }
    // const jsonString = JSON.stringify(fullPayload);
    // const encodedData = btoa(jsonString);
    // const telemetryUrl = "https://telemetry.magnitude.run/functions/v1/telemetry?data=" + encodedData;

    // Transformations needed:
    // 1. Count steps and checks
    // 2. Count number of web actions

    let numSteps: number = 0;
    let numChecks: number = 0;
    let browserActionCount: number = 0;

    for (const item of state.stepsAndChecks) {
        if (item.variant === 'step') {
            numSteps += 1;
            for (const action of item.actions) {
                if (action.variant.startsWith("browser")) {
                    browserActionCount += 1;
                }
            }
        } else {
            numChecks += 1;
        }
    }

    const userId = getMachineId();
    const codebaseId = getCodebaseId();

    const payload: TelemetryPayload = {
        telemetryVersion: '0.2',
        packageVersion: VERSION,
        codebase: codebaseId,
        startedAt: state.startedAt ?? Date.now(),
        doneAt: state.doneAt ?? Date.now(),
        numSteps: numSteps,
        numChecks: numChecks,
        browserActionCount: browserActionCount,
        modelUsage: state.modelUsage,
        passed: state.status === 'passed',
        failure: state.failure
    }
    // console.log("user ID:", userId);
    // console.log("codebase ID:", codebaseId);
    
    try {
        // const resp = await fetch(telemetryUrl, { signal: AbortSignal.timeout(3000) });
        // if (!resp.ok) {
        //     logger.warn(`Failed to send telemetry (status ${resp.status})`);
        // }
        posthog.capture({
            distinctId: userId,
            event: 'test-run',
            properties: {
                ...payload
            },
            groups: {
                // TODO: derive from git hash (also put it payload too)
                codebase: codebaseId
            }
        });
        // does NOT wait for HTTP request to fully finish so still need client.shutdown somewhere
        //await posthog.flush();
        // shutdown waits for http request to actually finish. ideally would do this per suite instead?
        await posthog.shutdown();
    } catch (error) {
        logger.warn(`Failed to send telemetry (may have timed out): ${(error as Error).message}`);
    }
}

export function getMachineId(): string {
    // Define storage location
    const dir = path.join(os.homedir(), '.magnitude');
    const filePath = path.join(dir, 'user.json');

    try {
        // Read existing ID if available
        if (fs.existsSync(filePath)) {
            const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            if (data.id) return data.id;
        }

        // Generate new ID if needed
        //console.log(`generating new ID in ${filePath}`)
        fs.mkdirSync(dir, { recursive: true });
        const id = createId();
        fs.writeFileSync(filePath, JSON.stringify({ id }));
        return id;
    } catch {
        // Fallback to temporary ID if storage fails
        return createId();
    }
}

export function getCodebaseId(): string {
  try {
    const command = 'git rev-list --max-parents=0 HEAD';
    const firstCommitHash = execSync(command, {
      encoding: 'utf8',
      stdio: 'pipe',
    }).trim();

    //return firstCommitHash;
    return createHash('sha256').update(firstCommitHash).digest('hex').substring(0, 12);

  } catch (error) {
    // ID representing no git repo detected
    return '000000000000';
  }
}