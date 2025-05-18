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

function CreatePartialRecipe (context: MemoryContext, task: string) -> PartialRecipe {
    client GeminiPro
    prompt #"
        {{ _.role("system") }}
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

        <targeting>
        Target descriptions are located by a small vision LLM. They should be:
        (1) Based only on what can be seen in the screenshot right now.
        (2) Positional information, shapes, and text - no high level abstractions.
        (3) Simple but unique enough to be distinguished specifically from anything matching a similar description.
        When in doubt - a SHORTER description is often more effective. For example, if targetting unique text - just the text itself is sufficient.
        </targeting>

        <instructions>
        Plan out web actions that should be executed in order to complete the task:
        <task>{{ task }}</task>
        Only plan out actions that involve things you can see right now.
        </instructions>
        
        {{ ctx.output_format }}

        {{ _.role("user") }}

        {{ DescribeMemoryContext(context) }}
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