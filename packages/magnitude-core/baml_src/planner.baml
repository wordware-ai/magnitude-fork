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

function CreatePartialRecipe (context: BrowserExecutionContext, task: string) -> PartialRecipe {
    client GeminiPro
    prompt #"
        {{ _.role("system") }}
        Plan out web actions that should be executed in order to complete the task:
        <task>{{ task }}</task>
        Do not always take the step exactly literally - if ambiguity use common sense.
        Target descriptions are located by a small vision LLM. They should be:
        (1) Based only on what can be seen in the screenshot right now.
        (2) Positional information, shapes, and text - no high level abstractions.
        (3) Simple but unique enough to be distinguished specifically from anything matching a similar description.
        Only plan out actions that involve things you can see right now.
        Note that many actions combine click + something else, so you may not need to click separately.
        For scroll, describe ONE specific element IN the appropriate container rather than trying to describe the container itself.
        
        {{ ctx.output_format }}

        {{ _.role("user") }}

        {{ DescribeBrowserExecutionContext(context) }}
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