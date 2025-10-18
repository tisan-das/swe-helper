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
	vscode.chat.createChatParticipant("vscode-msql-chat", async (request, context, response, token) => {
		const userQuery = request.prompt;

		const chatModels = await vscode.lm.selectChatModels({family: "gpt-4"});
		const messages = [
			vscode.LanguageModelChatMessage.User(userQuery)
		];
		const chatRequest = await chatModels[0].sendRequest(messages, undefined, token);
		for await (const token of chatRequest.text){
			response.markdown(token);
		}
	});

	// Register a command to run the SQL query from the chat response
	vscode.commands.registerCommand("vscode-msql-chat.summarizeDatabase", () => {
		vscode.commands.executeCommand('workbench.action.chat.open', '@mssql generate a summary of the codebase');
	});
}

// This method is called when your extension is deactivated
export function deactivate() {}
