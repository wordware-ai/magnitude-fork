class ClickIntent {
    variant "click" @description(#"
        Click something
    "#)
    target string @description(#"
        Where exactly to click
    "#)
}

class TypeIntent {
    variant "type" @description(#"
        Click something and type into it
    "#)
    target string @description(#"
        Where exactly to click before typing
    "#)
    content string @description(#"
        Content to type, insert sequences <enter> or <tab> for those keypresses respectively.
    "#)
}

class ScrollIntent {
    variant "scroll" @description(#"
        Hover mouse over target and scroll
    "#)
    target string @description(#"
        Somewhere specific inside the container to scroll in
    "#)
    deltaX int @description(#"
        Pixels to scroll horizontally
    "#)
    deltaY int @description(#"
        Pixels to scroll vertically
    "#)
}

class SwitchTabIntent {
    variant "tab" @description(#"
        Switch tabs
    "#)
    index int @description(#"
        Index of tab to switch to
    "#)
}

class CheckIntent {
    variant "check"
    checks string[]
}

type Intent = ActionIntent | CheckIntent
type ActionIntent = ClickIntent | TypeIntent | ScrollIntent | SwitchTabIntent

class PartialRecipe {
    // this CoT pipeline is not thoroughly tested against alternatives
    observations string @description(#"Any key observations about past actions or current state"#)
    meta_reasoning string @description(#"Reflect on the current state of task execution with respect to your own abilities as an agent"#)
    reasoning string @description(#"Consider what you can see right now and what actions you can plan without guessing"#)
    //actions ActionIntent[]
    @@dynamic
    //finished bool
}

class OpenTab {
    title string
    url string
}

class TabState {
    activeTab int
    tabs OpenTab[]
}

class MemoryContextLog {
    timestamp string
    message string
    screenshot image?
}

class MemoryContext {
    logs MemoryContextLog[]
    timestamp string
    tabs TabState//string
    screenshot image
}

template_string DescribeMemoryContext(context: MemoryContext) #"
    <logs>
    {%for log in context.logs %}
    [{{log.timestamp}}] {{log.message}}
    {%if log.screenshot%}{{log.screenshot}}{%endif%}
    {%endfor%}
    </logs>

    <state>
    Current time: {{ context.timestamp }}
    {{ DescribeTabState(context.tabs) }}
    {{ context.screenshot }}
    </state>
"#

// render "chunked" multimedia content of strings or images with no added whitespace between
template_string RenderContent(content: (string | image)[]) #"
    {% for chunk in content -%}{{chunk}}{%- endfor %}
"#


template_string DescribeModularMemoryContext(context: ModularMemoryContext) #"
    <logs>
    {% for entry in context.history %}
        {% if entry.variant == "thought" %}
            [{{entry.timestamp}}] {{entry.message}}
        {% elif entry.variant == "turn" %}
            [{{entry.timestamp}}] {{entry.action}}
            {{ RenderContent(entry.content) }}
        {% endif %}
    {% endfor %}
    </logs>

    <state>
    Current time: {{ context.current_timestamp }}
    {% for connector_state in context.current_connector_states %}
    {% if connector_state.connector_id == "web" %}
    {{ RenderContent(connector_state.content) }}
    {% endif %}
    {% endfor %}
    </state>
"#

template_string DescribeTabState(tabState: TabState) #"
    <tabs>
    {%for tab in tabState.tabs%}
        {%if tabState.activeTab == loop.index0%}
        {{ loop.index0 }} [ACTIVE]: {{ tab.title }} ({{tab.url}})
        {%else%}
        {{ loop.index0 }}: {{ tab.title }} ({{tab.url}})
        {%endif%}
    {%endfor%}
    </tabs>
"#


class BrowserExecutionContext {
    screenshot image
    actionHistory string[]
    tabState TabState
}

// screenshot: image, actionHistory: string[], tabState: TabState
template_string DescribeBrowserExecutionContext (context: BrowserExecutionContext) #"
    <browser_state>
        <action_history>
        {%for action in context.actionHistory%}
        {{ action }}
        {%endfor%}
        </action_history>

        <open_tabs>
        {%for tab in context.tabState.tabs%}
            {%if context.tabState.activeTab == loop.index0%}
            {{ loop.index0 }} [ACTIVE]: {{ tab.title }} ({{tab.url}})
            {%else%}
            {{ loop.index0 }}: {{ tab.title }} ({{tab.url}})
            {%endif%}
        {%endfor%}
        </open_tabs>

        <current_screenshot>
        {{ context.screenshot }}
        </current_screenshot>
    </browser_state>
"#

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

template_string TargetingInstructions #"
    <targeting>
    Targets descriptions must be carefully chosen to be accurately picked up by Moondream.
    Build a "minimal unique identifier" - a description that is as brief as possible that uniquely identifies the target on the page.
    Use only the information needed, and prioritize in this order:
    - specific text
    - specific shapes and colors
    - positional information
    - high level information (Moondream cannot always understand high level concepts)
    </targeting>
"#

// TODO: connector system instructions
function CreatePartialRecipe (context: ModularMemoryContext, task: string) -> PartialRecipe {
    client GeminiPro
    prompt #"
        {{ _.role("system") }}
        <instructions>
        Plan out actions that should be executed in order to complete the task:
        <task>{{ task }}</task>
        
        Plan out as many actions as possible, but stopping at the point where you will need to observe to plan further.
        </instructions>
        
        {{ ctx.output_format }}

        {{ _.role("user") }}

        {{ DescribeModularMemoryContext(context) }}
    "# 
}

class EvaluatedCheck {
    reasoning string
    passes bool
}

// function Foo() -> @@dynamic {

// }

//type FooThing = @@dynamic

//type FooThing2 = string
//Placeholder

// Moondream struggles to handle converted check, this is a bypass to use big model to evaluate check directly
function EvaluateCheck (context: BrowserExecutionContext, check: string) -> EvaluatedCheck {
    client GeminiPro
    prompt #"
        {{ _.role("system") }}
        Given the actions of an LLM agent executing a test case, and a screenshot taken afterwards, evaluate whether the provided check "passes" i.e. holds true or not.
        {{ ctx.output_format }}

        {{ _.role("user")}}
        Check to evaluate:
        <check>{{ check }}</check>

        {{ DescribeBrowserExecutionContext(context) }}
    "# 
}
