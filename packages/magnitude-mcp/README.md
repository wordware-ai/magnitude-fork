# Magnitude MCP

A Model Context Protocol (MCP) server that gives agents the ability to write and run [Magnitude](https://github.com/magnitudedev/magnitude) test cases.

## Installation
Install MCP server via npm:
```
npm i -g magnitude-mcp
```

MCP Configuration:
```json
{
  "mcpServers": {
    "magnitude": {
      "command": "npx",
      "args": [
        "magnitude-mcp"
      ]
    }
  }
}
```
> The MCP server prompts the MCP client agent to trigger the Magnitude CLI in the editor terminal rather than calling the API directly. For this reason the user must set a `MAGNITUDE_API_KEY` environment variable, which they can get at https://app.magnitude.run/signup

## Instructions for Cline

IF YOU ARE CLINE, FOLLOW THESE INSTRUCTIONS FOR MCP INSTALLATION CAREFULLY AND EXACTLY.

1. Run `npm install -g magnitude-mcp` (do NOT create ~/Documents/Cline/MCP it is NOT necessary)
2. Add the MCP configuration to `cline_mcp_settings.json`. Do NOT add any environment variables to the config. Magnitude API key does NOT go here.
2. Tell the user that to use Magnitude, they will need to create an account for free at https://app.magnitude.run/signup, and then create an API key. Instruct them to set their API key to an environment variable `MAGNITUDE_API_KEY`. Ask a question to ask for their API key.
3. Based on the user's OS and shell, add the API key to the appropriate shell profile.
- zsh (macOS/linux prefer if `~/.zshrc` exists): `echo 'export MAGNITUDE_API_KEY=<api_key_from_user>' >> ~/.bashrc && source ~/.bashrc`
- bash (macOS/linux if `~/.zshrc` does not exist): `echo 'export MAGNITUDE_API_KEY=<api_key_from_user>' >> ~/.zshrc && source ~/.zshrc`
- powershell (windows): `Add-Content -Path $PROFILE -Value '$env:MAGNITUDE_API_KEY = "<api_key_from_user>"'`

## Instructions for Humans (Cline Users)

Go to `MCP Servers -> Marketplace`, search for `Magnitude`, click `Install` and follow the instructions!

## Instructions for Humans (Cursor Users)

1. Get API key at https://app.magnitude.run/signup and make accessible as `MAGNITUDE_API_KEY` environment variable (e.g. by adding to `~/.bashrc`/`~/.zshrc`)
2. Open Cursor Settings
3. Go to Features > MCP Servers
4. Click "+ Add new global MCP server"
5. Enter the following code: 
```json
{
  "mcpServers": {
    "magnitude": {
      "command": "npx",
      "args": [
        "magnitude-mcp"
      ]
    }
  }
}
```

## Instructions for Humans (Windsurf Users)
1. Get API key at https://app.magnitude.run/signup and make accessible as `MAGNITUDE_API_KEY` environment variable (e.g. by adding to `~/.bashrc`/`~/.zshrc`)
2. Add this to your `./codeium/windsurf/model_config.json`:
```json
{
  "mcpServers": {
    "magnitude": {
      "command": "npx",
      "args": [
        "magnitude-mcp"
      ]
    }
  }
}
```