import { Screenshot } from "@/web/types";
import { type PlannerClient } from '@/ai/types';
import sharp from "sharp";

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

export function convertToBamlClientOptions(client: PlannerClient): Record<string, any> {
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