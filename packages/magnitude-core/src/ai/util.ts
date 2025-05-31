import { GroundingClient, type LLMClient } from '@/ai/types';

function cleanNestedObject(obj: object): object {
    // Remove null/undefined key values entirely
    return Object.fromEntries(
        Object.entries(obj)
            // Filter out null/undefined values
            .filter(([_, value]) => value !== null && value !== undefined)
            // Process nested objects recursively
            .map(([key, value]) => [
                key,
                typeof value === 'object' ? cleanNestedObject(value) : value
            ])
    );
}

export function convertToBamlClientOptions(client: LLMClient): Record<string, any> {
    // extract options compatible with https://docs.boundaryml.com/ref/llm-client-providers/overview

    // Default to temperature 0.0
    // Some client options (e.g. azure) do not have a temperature setting
    const temp = 'temperature' in client.options ?
        (client.options.temperature ?? 0.0) : 0.0;

    let options: object;
    if (client.provider === 'anthropic') {
        options = {
            api_key: client.options.apiKey,
            model: client.options.model,
            temperature: temp,
        };
    } else if (client.provider === 'aws-bedrock') {
        options = {
            model_id: client.options.model,
            inference_configuration: {
                temperature: temp,
            }
        };
    } else if (client.provider === 'google-ai') {
        options = {
            base_url: client.options.baseUrl,
            model: client.options.model,
            api_key: client.options.apiKey,
            generationConfig: {
                temperature: temp,
                //thinking_budget: 0
            }
        };
    } else if (client.provider === 'vertex-ai') {
        options = {
            location: client.options.location,
            base_url: client.options.baseUrl,
            project_id: client.options.projectId,
            credentials: client.options.credentials,
            model: client.options.model,
            generationConfig: {
                temperature: temp,
            }
        };
    } else if (client.provider === 'openai') {
        options = {
            api_key: client.options.apiKey,
            model: client.options.model,
            temperature: temp,
        };
    } else if (client.provider === 'openai-generic') {
        options = {
            base_url: client.options.baseUrl,
            api_key: client.options.apiKey,
            model: client.options.model,
            temperature: temp,
            headers: client.options.headers
        };
    } else if (client.provider === 'azure-openai') {
        options = {
            resource_name: client.options.resourceName,
            deployment_id: client.options.deploymentId,
            api_version: client.options.apiVersion,
            api_key: client.options.apiKey
        };
    } else {
        throw new Error(`Invalid provider: ${(client as any).provider}`)
    }
    return cleanNestedObject(options);
}



export function tryDeriveUIGroundedClients(): { llm: LLMClient | null, grounding: GroundingClient | null } {
    let llm: LLMClient | null = null;
    let grounding: GroundingClient | null = null;

    // Best: Solo Grounded Claude
    if (process.env.ANTHROPIC_API_KEY) {
        llm = {
            provider: 'anthropic',
            options: {
                // TODO: do more testing on best claude model for visuals
                model: 'claude-sonnet-4-20250514',//'claude-3-7-sonnet-latest',
                apiKey: process.env.ANTHROPIC_API_KEY
            }
        }
        return { llm, grounding: null };
    }

    if (process.env.GOOGLE_API_KEY) {
        // Google AI Studio
        llm = {
            provider: 'google-ai',
            options: {
                model: 'gemini-2.5-pro-preview-03-25',
                apiKey: process.env.GOOGLE_API_KEY
            }
        }
    }

    if (process.env.OPENROUTER_API_KEY) {
        llm = {
            provider: 'openai-generic',
            options: {
                baseUrl: "https://openrouter.ai/api/v1",
                model: 'google/gemini-2.5-pro-preview-03-25',
                apiKey: process.env.OPENROUTER_API_KEY
            }
        }
    }

    if (process.env.OPENAI_API_KEY) {
        llm = {
            provider: 'openai',
            options: {
                model: 'gpt-4.1-2025-04-14',
                apiKey: process.env.OPENAI_API_KEY
            }
        }
    }

    if (process.env.MOONDREAM_API_KEY) {
        grounding = {
            provider: 'moondream',
            options: {
                apiKey: process.env.MOONDREAM_API_KEY
            }
        }
    }

    return { llm , grounding };
}

export function isGroundedLlm(llm: LLMClient) {
    if (llm.provider === 'anthropic' || llm.provider === 'aws-bedrock' || llm.provider === 'vertex-ai') {
        const model = llm.options.model;
        const include = ['claude-sonnet', 'claude-opus', 'claude-3-5', 'claude-3-7', 'claude-4'];
        const exclude = ['claude-3-5-haiku'];
        for (const substr of exclude) {
            if (model.includes(substr)) return false;
        }
        for (const substr of include) {
            if (model.includes(substr)) return true;
        }
    }
    return false;
}

export function isClaude(llm: LLMClient) {
    // same for now
    return isGroundedLlm(llm);
}