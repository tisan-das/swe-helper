// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';

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
{{paste the selected code here}}
—— CODE END ——

`;
		vscode.commands.executeCommand("workbench.action.chat.open", '@swe-help ${prompt}');
	});

	context.subscriptions.push(reviewCommand);
}

// This method is called when your extension is deactivated
export function deactivate() {}
