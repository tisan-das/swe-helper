# swe-helper README


## Features

## Requirements

If you have any requirements or dependencies, add a section describing those and how to install and configure them.

## Extension Settings

Include if your extension adds any VS Code settings through the `contributes.configuration` extension point.

For example:

This extension contributes the following settings:

* `myExtension.enable`: Enable/disable this extension.
* `myExtension.thing`: Set to `blah` to do something.


## JIRA Integration Setup

1. **Generate JIRA API Token**:
   - Go to https://id.atlassian.com/manage-profile/security/api-tokens
   - Click "Create API token"
   - Give it a label (e.g., "VSCode SWE Helper")
   - Copy the generated token

2. **Configure Extension**:
   - Open VS Code Settings (Cmd/Ctrl + ,)
   - Search for "SWE Helper"
   - Set the following:
     - swe-helper.jiraBaseUrl: Your JIRA URL (e.g., https://yourcompany.atlassian.net)
     - swe-helper.jiraEmail: Your JIRA email address
     - swe-helper.jiraApiToken: The API token you generated

3. **Use the Fix Bug Command**:
   - Open Command Palette (Cmd/Ctrl + Shift + P)
   - Type "SWE-Helper: Fix bug from JIRA ticket"
   - Enter the JIRA ticket ID (e.g., PROJ-123)
   - The extension will fetch the ticket and suggest code fixes


## Known Issues

Calling out known issues can help limit users opening duplicate issues against your extension.

## Release Notes

Users appreciate release notes as you update your extension.

### 0.0.1
Initial release

