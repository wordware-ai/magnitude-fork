class PartialRecipe {
    // this CoT pipeline is not thoroughly tested against alternatives
    // observations string? @description(#"Any key observations about past actions or current state"#)
    // meta_reasoning string @description(#"Reflect on the current state of task execution with respect to your own abilities as an agent"#)
    // reasoning string @description(#"Consider what you can see right now and what actions you can plan without guessing"#)

    // Simplifying CoT - seemed to be causing underplanning on Claude
    //observations string @description(#"What important clues or key information are worth considering?"#)
    reasoning string @description(#"What is the most actions you can safely take at once?"#)

    //actions ActionIntent[]
    @@dynamic
    //finished bool
}


// render "chunked" multimedia content of strings or images with no added whitespace between
template_string RenderContent(content: (string | image)[]) #"
    {% for chunk in content -%}{{chunk}}{%- endfor %}
"#


// template_string DescribeModularMemoryContext(context: ModularMemoryContext) #"
//     {% for entry in context.history %}
//         {% if entry.variant == "thought" %}
//             [{{entry.timestamp}}] {{entry.message}}
//         {% elif entry.variant == "turn" %}
//             [{{entry.timestamp}}] {{entry.action}}
//             {{ RenderContent(entry.content) }}
//         {% endif %}
//     {% endfor %}
// "#

// unused
template_string HybridMeta #"
    <meta>
    You are a web agent powered by (1) a powerful LLM (you) and (2) a small vision model (Moondream).
    You operate by planning out actions over time to try and complete a certain task.
    To do this successfully you may need to consider and adjust for your own limitations as an agent, so here is some information about how you work:
    - You plan several actions ahead of time without trying to guess, which are then executed
    - You are then given a new screenshot of the webpage which is the result of all actions taken
    - This occurs in a loop until you complete your task
    - Mouse movements require a "target", which is located by Moondream as a specific coordinate on the page
    - Moondream may sometimes fail to locate the target you expected it to.
    - Therefore, actions may not always be completely successful and you may need to try different variations
    </meta>
"#

template_string DescribeConnectorInstructions(context: ModularMemoryContext) #"
    {% for conn in context.connectorInstructions %}
    <{{ conn.connectorId }}>
    {{- conn.instructions -}}
    </{{ conn.connectorId }}>
    {% endfor %}
"#


// TODO: connector system instructions
function CreatePartialRecipe (context: ModularMemoryContext, task: string) -> PartialRecipe {
    client GeminiPro
    prompt #"
        {{ _.role("system") }}
        <instructions>
        Plan out actions that should be executed in order to complete the task:
        <task>{{ task }}</task>
        
        Execute the task serially.
        Plan out as many actions as possible, but stopping at the point where you will need to observe to plan further.
        </instructions>

        {{ DescribeConnectorInstructions(context) }}
        
        {{ ctx.output_format }}

        {{ _.role("user") }}

        {{ RenderContent(context.observationContent) }}
    "# 
}

class EvaluatedCheck {
    reasoning string
    passes bool
}


// Moondream struggles to handle converted check, this is a bypass to use big model to evaluate check directly
// function EvaluateCheck (context: BrowserExecutionContext, check: string) -> EvaluatedCheck {
//     client GeminiPro
//     prompt #"
//         {{ _.role("system") }}
//         Given the actions of an LLM agent executing a test case, and a screenshot taken afterwards, evaluate whether the provided check "passes" i.e. holds true or not.
//         {{ ctx.output_format }}

//         {{ _.role("user")}}
//         Check to evaluate:
//         <check>{{ check }}</check>

//         {{ DescribeBrowserExecutionContext(context) }}
//     "# 
// }
