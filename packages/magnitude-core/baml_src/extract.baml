// if primitive, populate key "data"
// if array, populate key data with that array
// else fill with object fields
class ExtractedData {
    @@dynamic
}

function ExtractData (instructions: string, screenshot: image, domContent: string) -> ExtractedData {
    client GeminiPro
    prompt #"
        {{ _.role("system") }}
        Based on the browser screenshot and page content, extract data according to these instructions:
        <instructions>{{ instructions }}</instructions>
        
        {{ ctx.output_format }}

        {{ _.role("user") }}

        {{ domContent }}

        {{ screenshot }}
    "#
}