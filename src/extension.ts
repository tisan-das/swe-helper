// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { Buffer } from 'node:buffer';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// // Use the console to output diagnostic information (console.log) and errors (console.error)
	// // This line of code will only be executed once when your extension is activated
	// console.log('Congratulations, your extension "swe-helper" is now active!');

	// // The command has been defined in the package.json file
	// // Now provide the implementation of the command with registerCommand
	// // The commandId parameter must match the command field in package.json
	// const disposable = vscode.commands.registerCommand('swe-helper.helloWorld', () => {
	// 	// The code you place here will be executed every time your command is executed
	// 	// Display a message box to the user
	// 	vscode.window.showInformationMessage('Hello World from swe-helper!');
	// });

	// context.subscriptions.push(disposable);

	// Register a chat participant that can respond to the user queries
	const chatParticipant = vscode.chat.createChatParticipant("swe-helper-chat", async (request, context, response, token) => {
		const userQuery = request.prompt;

		// const chatModels = await vscode.lm.selectChatModels({vendor: 'copilot',family: 'claude-sonnet-4-5'});
		// if (chatModels.length === 0) {
		// 	response.markdown("Claude Sonnet 4.5 is not available. Please check your Copilot subscription and settings.");
		// 	return { errorDetails: { message: "Claude Sonnet 4.5 not available" } };
		// }
		const messages = [
			vscode.LanguageModelChatMessage.User(userQuery)
		];
		const chatRequest = await request.model.sendRequest(messages, undefined, token);
		for await (const token of chatRequest.text){
			response.markdown(token);
		}
	});
	context.subscriptions.push(chatParticipant);

	// Register a command to review the selected code
	const reviewCommand = vscode.commands.registerCommand("swe-helper-chat.reviewSelectedCode", () => {
		
		// Get the selected code
		const editor = vscode.window.activeTextEditor;
		if(!editor){
			vscode.window.showErrorMessage("No active editor is found. Please select some code first!");
			return;
		}

		const selectedText = editor.document.getText(editor.selection);
		if(!selectedText){
			vscode.window.showErrorMessage("No code is selected. Please select some code to review!");
			return;
		}

		const prompt = `
You are a senior, security-focused code reviewer. Analyze the provided code added in the context and produce a concise, actionable review.

Rules:

Only reason from the given artifacts. Do not invent unavailable files or behavior.

Prefer specific file:line references when possible.

Keep recommendations minimal, safe-by-default, and practical.

If a section has no findings, write “None found.”

Use clear, single-sentence bullets. Do not nest lists.

Checks to perform:

Identify vulnerable or risky third-party modules and versions, including transitive risks where evident from import paths.

Detect potential security breaches, including injection, deserialization, SSRF, RCE, path traversal, auth/session flaws, crypto misuse, secrets exposure, insecure transport, and access control gaps.

Flag syntax and static errors, undefined names, type issues, and lint-level correctness problems.

Separate high-impact, high-likelihood defects as major issues and low-impact or stylistic concerns as minor issues.

Propose minimal, concrete fixes with short code snippets when beneficial.

Note any missing tests for critical paths.

Output format (Markdown):

Summary
Language(s) detected and key components reviewed.

Overall risk rating: Low, Medium, or High, with a one-sentence rationale.

Vulnerable modules
Module and version, usage location, known risk or CVE if known, impact, and the safest fixed version or mitigation.

Potential security breaches
Issue, file:line, impact and exploit scenario in one sentence, and the most direct fix.

Syntax and static errors
Error or warning, file:line, the precise cause, and the fix.

Major issues
Issue, file:line, why it is high impact or likely, and the minimal safe remediation.

Minor issues
Issue, file:line, rationale, and a quick improvement.

Suggested patches
Short before/after code snippets for the most critical one or two fixes.

Tests to add
One-sentence test ideas that would catch or prevent the top issues.

Confidence and gaps
Confidence level and what additional files or context would improve accuracy.

Code to review (do not analyze anything outside this block):
—— CODE START ——
${selectedText}
—— CODE END ——

`;
		vscode.commands.executeCommand("workbench.action.chat.open", `@swe-help ${prompt}`);
	});

	context.subscriptions.push(reviewCommand);

    // Register a generic command to work on JIRA tickets (bugs and features)
    const workOnJiraTicketCommand = vscode.commands.registerCommand("swe-helper-chat.workOnJiraTicket", async () => {
        // Prompt user for JIRA ticket ID
        const jiraTicketId = await vscode.window.showInputBox({
            prompt: "Enter JIRA ticket ID (e.g., PROJ-123)",
            placeHolder: "PROJ-123",
            validateInput: (value) => {
                if (!value || !/^[A-Z]+-\d+$/i.test(value)) {
                    return "Please enter a valid JIRA ticket ID (e.g., PROJ-123)";
                }
                return null;
            }
        });

        if (!jiraTicketId) {
            return;
        }

        // Get JIRA configuration from settings
        const config = vscode.workspace.getConfiguration('swe-helper');
        const jiraBaseUrl = config.get<string>('jiraBaseUrl');
        const jiraEmail = config.get<string>('jiraEmail');
        
        // Try to get API token from SecretStorage first, fallback to config
        let jiraApiToken = await context.secrets.get('swe-helper.jiraApiToken');
        if (!jiraApiToken) {
            jiraApiToken = config.get<string>('jiraApiToken');
        }

        if (!jiraBaseUrl || !jiraApiToken || !jiraEmail) {
            const shouldConfigure = await vscode.window.showErrorMessage(
                "JIRA configuration is missing. Would you like to configure it now?",
                "Configure", "Cancel"
            );
            
            if (shouldConfigure === "Configure") {
                const token = await vscode.window.showInputBox({
                    prompt: "Enter your JIRA API token",
                    password: true,
                    placeHolder: "Your JIRA API token (will be stored securely)"
                });
                if (token) {
                    await context.secrets.store('swe-helper.jiraApiToken', token);
                    vscode.window.showInformationMessage("JIRA API token saved securely. Please also configure base URL and email in settings.");
                }
            }
            return;
        }

        try {
            // Show progress indicator
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: `Fetching JIRA ticket ${jiraTicketId}...`,
                cancellable: false
            }, async () => {
                // Fetch JIRA ticket details with comments
                const auth = Buffer.from(`${jiraEmail}:${jiraApiToken}`).toString('base64');
                
                // Fetch issue with expanded comments
                const response = await fetch(`${jiraBaseUrl}/rest/api/3/issue/${jiraTicketId}`, {
                    headers: {
                        'Authorization': `Basic ${auth}`,
                        'Accept': 'application/json'
                    }
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    console.error('JIRA API Error Response:', errorText);
                    throw new Error(`Failed to fetch JIRA ticket (${response.status}): ${response.statusText}`);
                }

                let issueData: any;
                try {
                    issueData = await response.json();
                } catch (parseError) {
                    console.error('Failed to parse JSON response:', parseError);
                    throw new Error('Failed to parse JIRA API response as JSON');
                }
                
                // Debug: Log the full response structure
                console.log('JIRA API Response received');
                console.log('Response type:', typeof issueData);
                console.log('Response has fields?', issueData && 'fields' in issueData);
                
                // Check for JIRA API errors
                // Validate that we have the fields property with better type checking
                if (!issueData || typeof issueData !== 'object') {
                    console.error('Invalid JIRA response - not an object:', issueData);
                    throw new Error(`Invalid JIRA API response. Expected an object but got ${typeof issueData}`);
                }

                if (!Object.prototype.hasOwnProperty.call(issueData, 'fields')) {
                    console.error('Invalid JIRA response structure.');
                    console.error('Response keys:', Object.keys(issueData));
                    console.error('Full response:', JSON.stringify(issueData, null, 2));
                    throw new Error(`Invalid JIRA API response. Response is missing 'fields' property. Available keys: ${Object.keys(issueData).join(', ')}`);
                }

                const fields = issueData.fields;

                // Safely extract fields with fallbacks
                const summary = fields.summary || "No summary available";
                const issueType = fields.issuetype?.name || "Unknown";
                const priority = fields.priority?.name || "Not set";
                const status = fields.status?.name || "Unknown";
                const assignee = fields.assignee?.displayName || "Unassigned";
                const reporter = fields.reporter?.displayName || "Unknown";
                const created = fields.created ? new Date(fields.created).toLocaleString() : "Unknown";
                const updated = fields.updated ? new Date(fields.updated).toLocaleString() : "Unknown";
                
                // Parse description - handle both old and new JIRA formats
                let description = "No description available";
                if (fields.description) {
                    if (typeof fields.description === 'string') {
                        // Old JIRA format
                        description = fields.description;
                    } else if (fields.description.content) {
                        // New JIRA format (Atlassian Document Format)
                        description = extractTextFromADF(fields.description);
                    }
                }

                // Parse acceptance criteria if available
                const acceptanceCriteria = fields.customfield_10000 || 
                                        fields.acceptanceCriteria || 
                                        "Not specified";

                // Extract and format comments
                let commentsSection = "";
                if (fields.comment && fields.comment.comments && fields.comment.comments.length > 0) {
                    const comments = fields.comment.comments;
                    commentsSection = "\n## Comments History\n\n";
                    
                    comments.forEach((comment: any, index: number) => {
                        const author = comment.author?.displayName || "Unknown";
                        const commentDate = comment.created ? new Date(comment.created).toLocaleString() : "Unknown date";
                        let commentBody = "No content";
                        
                        // Parse comment body (can be ADF or plain text)
                        if (comment.body) {
                            if (typeof comment.body === 'string') {
                                commentBody = comment.body;
                            } else if (comment.body.content) {
                                commentBody = extractTextFromADF(comment.body);
                            }
                        }
                        
                        commentsSection += `### Comment ${index + 1} by ${author} (${commentDate})\n${commentBody}\n\n`;
                    });
                } else {
                    commentsSection = "\n## Comments History\nNo comments available.\n\n";
                }

                // Extract attachments if any
                let attachmentsSection = "";
                if (fields.attachment && fields.attachment.length > 0) {
                    attachmentsSection = "\n## Attachments\n";
                    fields.attachment.forEach((att: any) => {
                        attachmentsSection += `- ${att.filename} (${att.size} bytes) - ${att.content}\n`;
                    });
                    attachmentsSection += "\n";
                }

                // Extract linked issues
                let linkedIssuesSection = "";
                if (fields.issuelinks && fields.issuelinks.length > 0) {
                    linkedIssuesSection = "\n## Linked Issues\n";
                    fields.issuelinks.forEach((link: any) => {
                        const linkType = link.type?.name || "Unknown";
                        const linkedIssue = link.outwardIssue || link.inwardIssue;
                        if (linkedIssue) {
                            linkedIssuesSection += `- ${linkType}: ${linkedIssue.key} - ${linkedIssue.fields?.summary || 'No summary'}\n`;
                        }
                    });
                    linkedIssuesSection += "\n";
                }

                // Get workspace context
                const workspaceFolders = vscode.workspace.workspaceFolders;
                const workspaceContext = workspaceFolders 
                    ? `Workspace: ${workspaceFolders[0].uri.fsPath}` 
                    : "No workspace opened";

                // Get currently opened file for context
                const editor = vscode.window.activeTextEditor;
                const currentFileContext = editor 
                    ? `Current file: ${editor.document.fileName}\n\nCurrent file content:\n\`\`\`${editor.document.languageId}\n${editor.document.getText()}\n\`\`\``
                    : "No file currently opened";

                // Determine if it's a bug or feature based on issue type
                const isBug = /bug|defect|error|issue/i.test(issueType);
                const isFeature = /feature|story|enhancement|epic|task/i.test(issueType);

                let prompt = `
You are an expert software engineer working on a JIRA ticket. Analyze the ticket details, comments, and codebase context to suggest specific implementation steps and code changes.

## JIRA Ticket Details

**Ticket ID:** ${jiraTicketId}
**Type:** ${issueType}
**Priority:** ${priority}
**Status:** ${status}
**Reporter:** ${reporter}
**Assignee:** ${assignee}
**Created:** ${created}
**Last Updated:** ${updated}

**Summary:** ${summary}

**Description:**
${description}

${acceptanceCriteria !== "Not specified" ? `**Acceptance Criteria:**\n${acceptanceCriteria}\n` : ''}
${commentsSection}
${linkedIssuesSection}
${attachmentsSection}

## Codebase Context

${workspaceContext}
${currentFileContext}

---

Your task:
    `;

                if (isBug) {
                    prompt += `
This is a **BUG** ticket. Pay special attention to:
1. The bug description and reproduction steps
2. Comments that might contain additional debugging information, error logs, or clarifications
3. Any linked issues that might be related or provide context
4. Understanding the root cause from the description and comments
5. Identifying where the bug is occurring in the codebase
6. Suggesting specific code changes to fix the bug
7. Explaining why these changes will resolve the issue
8. Recommending regression tests to prevent similar bugs
9. Highlighting any potential side effects or related areas to check

Format your response as:

## Root Cause Analysis
[Detailed analysis of what's causing the bug and why it occurs, considering information from comments]

## Key Insights from Comments
[Highlight important information from the comments that helps understand or fix the bug]

## Bug Location
[Identify the specific files and functions where the bug exists]

## Suggested Fix
[Provide specific before/after code snippets for the fix]

## Explanation
[Why these changes will resolve the bug, addressing points raised in comments]

## Regression Tests
[Specific test cases to add that would have caught this bug]

## Impact Analysis
[Potential side effects and related areas that might be affected]

## Verification Steps
[How to manually verify the fix works, including any test scenarios mentioned in comments]
    `;
                } else if (isFeature) {
                    prompt += `
This is a **FEATURE/ENHANCEMENT** ticket. Pay special attention to:
1. The feature requirements and acceptance criteria
2. Comments that might contain clarifications, design discussions, or additional requirements
3. Any linked issues that provide context or dependencies
4. Breaking down the feature into implementation steps
5. Identifying files that need to be created or modified
6. Suggesting architecture and design patterns
7. Providing specific code implementation with examples
8. Recommending comprehensive test coverage
9. Highlighting integration points and dependencies

Format your response as:

## Feature Analysis
[Break down the feature requirements and acceptance criteria, incorporating insights from comments]

## Key Insights from Comments
[Highlight important clarifications, decisions, or requirements discussed in comments]

## Implementation Plan
[Step-by-step plan for implementing this feature, considering discussion points]

## Architecture & Design
[Recommended approach, design patterns, and architectural considerations]

## Files to Create/Modify
[List all files that need changes with their purposes]

## Code Implementation
[Provide specific code snippets with clear before/after examples]

## Integration Points
[Identify how this integrates with existing code and external systems, including linked issues]

## Test Strategy
[Comprehensive test cases including unit, integration, and e2e tests]

## Documentation Updates
[What documentation needs to be added or updated]

## Potential Challenges
[Technical challenges and suggested solutions, addressing concerns raised in comments]

## Dependencies & Blockers
[Any dependencies or blockers mentioned in comments or linked issues]
    `;
                } else {
                    // Generic task
                    prompt += `
This is a **TASK** ticket. Analyze the ticket including all comments and provide:
1. Understanding of what needs to be done
2. Key points and clarifications from comments
3. Step-by-step implementation approach
4. Files and code changes needed
5. Testing recommendations
6. Any risks or considerations

Format your response as:

## Task Analysis
[What needs to be accomplished based on description and comments]

## Key Discussion Points
[Important information from comments that affects implementation]

## Implementation Steps
[Detailed step-by-step approach considering all context]

## Code Changes
[Specific code snippets and modifications needed]

## Testing Plan
[How to test this implementation]

## Considerations
[Any risks, dependencies, or special considerations raised in comments]

## Related Context
[Information from linked issues or attachments that's relevant]
    `;
                }

                vscode.commands.executeCommand("workbench.action.chat.open", `@swe-help ${prompt}`);
            });
        } catch (error) {
            // Enhanced error reporting
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error('JIRA Fetch Error:', error);
            
            vscode.window.showErrorMessage(
                `Failed to fetch JIRA ticket: ${errorMessage}`,
                "View Output"
            ).then(selection => {
                if (selection === "View Output") {
                    vscode.commands.executeCommand("workbench.action.output.toggleOutput");
                }
            });
        }
    });

    context.subscriptions.push(workOnJiraTicketCommand);


    // Register a command to generate diagrams for code
    const generateDiagramCommand = vscode.commands.registerCommand("swe-helper-chat.generateDiagram", async () => {
        // Get the selected code or entire file
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage("No active editor is found. Please open a file first!");
            return;
        }

        // Check if there's a selection, otherwise use the entire file
        const selection = editor.selection;
        const hasSelection = !selection.isEmpty;
        const codeToAnalyze = hasSelection 
            ? editor.document.getText(selection)
            : editor.document.getText();
        
        if (!codeToAnalyze.trim()) {
            vscode.window.showErrorMessage("No code found to generate diagram!");
            return;
        }

        const fileName = editor.document.fileName;
        const languageId = editor.document.languageId;
        const scope = hasSelection ? "selected code" : "entire file";

        // Ask user what type of diagram they want
        const diagramType = await vscode.window.showQuickPick([
            {
                label: "Class Diagram",
                description: "Shows classes, interfaces, and their relationships",
                value: "class"
            },
            {
                label: "Sequence Diagram",
                description: "Shows interactions between components over time",
                value: "sequence"
            },
            {
                label: "Flow Diagram",
                description: "Shows program flow and control structures",
                value: "flow"
            },
            {
                label: "Architecture Diagram",
                description: "Shows high-level system architecture and dependencies",
                value: "architecture"
            },
            {
                label: "Call Graph",
                description: "Shows function/method call relationships",
                value: "callgraph"
            },
            {
                label: "Entity Relationship Diagram (ERD)",
                description: "Shows database entities and relationships",
                value: "erd"
            },
            {
                label: "Component Diagram",
                description: "Shows components and their dependencies",
                value: "component"
            }
        ], {
            placeHolder: "Select diagram type to generate",
            title: "Diagram Type"
        });

        if (!diagramType) {
            return;
        }

        const prompt = `
You are an expert software architect and technical diagramming specialist. Analyze the provided code and generate a comprehensive ${diagramType.label}.

## Context
- **File**: ${fileName}
- **Language**: ${languageId}
- **Scope**: ${scope}

## Code to Analyze
\`\`\`${languageId}
${codeToAnalyze}
\`\`\`

## Instructions

Generate a detailed ${diagramType.label} using Mermaid syntax.

### For ${diagramType.label}:
${getDiagramInstructions(diagramType.value)}

### CRITICAL: Mermaid Rendering Format

Your response MUST use this EXACT format for the diagram to render:

**Step 1:** Write a brief overview (1-2 sentences)

**Step 2:** Write the code fence opening on its own line:
\\\`\\\`\\\`mermaid

**Step 3:** Write your Mermaid diagram code (multiple lines)

**Step 4:** Write the code fence closing on its own line:
\\\`\\\`\\\`

**Step 5:** Provide analysis after the diagram

### Example of correct format:

Here's a flow diagram showing the code execution:

\\\`\\\`\\\`mermaid
flowchart TD
    Start([Start]) --> A[First Step]
    A --> B{Decision}
    B -->|Yes| C[Action 1]
    B -->|No| D[Action 2]
    C --> End([End])
    D --> End
\\\`\\\`\\\`

### Key Components
- Component descriptions here

### Relationships
- How things connect

---

**RENDERING REQUIREMENTS** (CRITICAL):
1. The opening fence MUST be exactly: \\\`\\\`\\\`mermaid (three backticks + word "mermaid")
2. The closing fence MUST be exactly: \\\`\\\`\\\` (three backticks alone)
3. Do NOT add any text on the same line as the backticks
4. Ensure valid Mermaid syntax (${getMermaidDiagramType(diagramType.value)})
5. Do NOT wrap the mermaid block in any other code blocks
6. The mermaid code block must be at the markdown root level (not nested)

### Mermaid Syntax Reference for ${diagramType.value}:
${getMermaidSyntaxExample(diagramType.value)}

Now analyze the code and generate the diagram following the EXACT format above.
`;

        vscode.commands.executeCommand("workbench.action.chat.open", `@swe-help ${prompt}`);
    });

    context.subscriptions.push(generateDiagramCommand);
}


// Helper function to extract text from Atlassian Document Format
function extractTextFromADF(adf: any): string {
    if (!adf || !adf.content) {
        return "No description available";
    }

    let text = '';
    
    function traverse(node: any): void {
        if (node.type === 'text') {
            text += node.text;
        } else if (node.type === 'hardBreak') {
            text += '\n';
        } else if (node.type === 'paragraph') {
            if (node.content) {
                node.content.forEach(traverse);
            }
            text += '\n\n';
        } else if (node.type === 'heading') {
            if (node.content) {
                const level = node.attrs?.level || 1;
                text += '\n' + '#'.repeat(level) + ' ';
                node.content.forEach(traverse);
                text += '\n';
            }
        } else if (node.type === 'bulletList' || node.type === 'orderedList') {
            if (node.content) {
                node.content.forEach((item: any, index: number) => {
                    const prefix = node.type === 'orderedList' ? `${index + 1}. ` : '- ';
                    text += prefix;
                    traverse(item);
                });
            }
        } else if (node.type === 'listItem') {
            if (node.content) {
                node.content.forEach(traverse);
                text += '\n';
            }
        } else if (node.type === 'codeBlock') {
            const language = node.attrs?.language || '';
            text += `\n\`\`\`${language}\n`;
            if (node.content) {
                node.content.forEach(traverse);
            }
            text += '\n\`\`\`\n';
        } else if (node.type === 'inlineCard' || node.type === 'blockCard') {
            // Handle Jira smart links
            const url = node.attrs?.url || '';
            text += url ? `[Link](${url})` : '[Link]';
        } else if (node.type === 'mention') {
            const userName = node.attrs?.text || node.attrs?.id || 'user';
            text += `@${userName}`;
        } else if (node.content) {
            node.content.forEach(traverse);
        }
    }

    adf.content.forEach(traverse);
    return text.trim() || "No description available";
}


// Add this helper function before the deactivate() function
function getDiagramInstructions(diagramType: string): string {
    switch (diagramType) {
        case 'class':
            return `- Show all classes, interfaces, abstract classes, and enums
- Include class members (properties and methods) with visibility modifiers
- Show inheritance (extends), implementation (implements), and associations
- Indicate abstract methods and classes
- Show multiplicities for relationships where relevant
- Use proper UML notation in Mermaid format`;

        case 'sequence':
            return `- Identify key actors/participants (users, systems, components)
- Show the sequence of method/function calls
- Include activation boxes for active periods
- Add notes for important logic or conditions
- Show loops, alternatives (if/else), and parallel execution
- Indicate return values and async operations`;

        case 'flow':
            return `- Map out the control flow from start to end
- Show decision points (if/else, switch) with diamond shapes
- Include loops (for, while) with appropriate notation
- Show function calls and returns
- Indicate error handling paths
- Add descriptive labels for all steps`;

        case 'architecture':
            return `- Identify major components, modules, or layers
- Show dependencies between components
- Indicate external systems or APIs
- Show data flow between components
- Include deployment or runtime boundaries if relevant
- Use grouping/subgraphs for related components`;

        case 'callgraph':
            return `- List all functions/methods as nodes
- Show caller-callee relationships with directed edges
- Indicate recursive calls
- Highlight entry points and leaf functions
- Group related functions if applicable
- Show call frequency or importance if evident`;

        case 'erd':
            return `- Identify all entities (tables, models, data structures)
- Show attributes/fields for each entity with data types
- Indicate primary keys and foreign keys
- Show relationships (one-to-one, one-to-many, many-to-many)
- Include cardinality and optionality
- Add constraints or indexes if mentioned`;

        case 'component':
            return `- Show major components as boxes
- Indicate provided and required interfaces
- Show dependencies between components
- Include external dependencies (libraries, APIs)
- Use ports for component interactions
- Group related components into packages or modules`;

        default:
            return `- Analyze the code structure carefully
- Create a clear and accurate representation
- Use appropriate Mermaid diagram syntax
- Include all relevant elements and relationships`;
    }
}


function getMermaidSyntaxExample(diagramType: string): string {
    switch (diagramType) {
        case 'class':
            return `Example:
\`\`\`mermaid
classDiagram
    class Animal {
        +String name
        +int age
        +makeSound()
    }
    class Dog {
        +bark()
    }
    Animal <|-- Dog
\`\`\``;

        case 'sequence':
            return `Example:
\`\`\`mermaid
sequenceDiagram
    participant User
    participant System
    User->>System: Request
    System-->>User: Response
\`\`\``;

        case 'flow':
            return `Example:
\`\`\`mermaid
flowchart TD
    Start([Start]) --> Decision{Is Valid?}
    Decision -->|Yes| Process[Process Data]
    Decision -->|No| Error[Show Error]
    Process --> End([End])
    Error --> End
\`\`\``;

        case 'architecture':
            return `Example:
\`\`\`mermaid
graph TB
    subgraph Frontend
        UI[User Interface]
    end
    subgraph Backend
        API[API Layer]
        DB[(Database)]
    end
    UI --> API
    API --> DB
\`\`\``;

        case 'callgraph':
            return `Example:
\`\`\`mermaid
graph LR
    main --> processData
    main --> validateInput
    processData --> saveToDatabase
    validateInput --> showError
\`\`\``;

        case 'erd':
            return `Example:
\`\`\`mermaid
erDiagram
    USER ||--o{ ORDER : places
    USER {
        int id PK
        string name
        string email
    }
    ORDER {
        int id PK
        int user_id FK
        date created_at
    }
\`\`\``;

        case 'component':
            return `Example:
\`\`\`mermaid
graph TB
    subgraph "Application Layer"
        A[Component A]
        B[Component B]
    end
    subgraph "Data Layer"
        C[Database]
    end
    A --> B
    B --> C
\`\`\``;

        default:
            return `Use standard Mermaid syntax with three backticks and 'mermaid' language identifier.`;
    }
}

function getMermaidDiagramType(diagramType: string): string {
    switch (diagramType) {
        case 'class':
            return 'classDiagram';
        case 'sequence':
            return 'sequenceDiagram';
        case 'flow':
            return 'flowchart TD or flowchart LR';
        case 'architecture':
            return 'graph TD or graph LR';
        case 'callgraph':
            return 'graph LR or graph TD';
        case 'erd':
            return 'erDiagram';
        case 'component':
            return 'graph TB';
        default:
            return 'flowchart TD';
    }
}

// This method is called when your extension is deactivated
export function deactivate() {}
