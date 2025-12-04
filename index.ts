import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { Database } from "bun:sqlite"; // Bun標準のSQLite!

// 1. データベースの初期化 (ファイルは自動作成されます)
const db = new Database("my_notes.db");
db.query(`
  CREATE TABLE IF NOT EXISTS notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT,
    content TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`).run();

// 2. MCPサーバの作成
const server = new McpServer({
	name: "bun-sqlite-notes",
	version: "1.0.0",
});

// ---------------------------------------------------------
// Tool 1: メモを追加する
// ---------------------------------------------------------
server.tool(
	"add_note",
	{
		title: z.string().describe("メモのタイトル"),
		content: z.string().describe("メモの内容"),
	},
	async ({ title, content }) => {
		try {
			const query = db.query("INSERT INTO notes (title, content) VALUES ($title, $content)");
			query.run({ $title: title, $content: content });
			return {
				content: [{ type: "text", text: `メモ「${title}」を保存しました！` }],
			};
		} catch (err) {
			return {
				content: [{ type: "text", text: `エラーが発生しました: ${String(err)}` }],
				isError: true,
			};
		}
	}
);

// ---------------------------------------------------------
// Tool 2: メモを検索する
// ---------------------------------------------------------
server.tool(
	"search_notes",
	{
		query: z.string().describe("検索したいキーワード"),
	},
	async ({ query }) => {
		// 簡易的なLIKE検索
		const sql = db.query("SELECT * FROM notes WHERE title LIKE $q OR content LIKE $q");
		const results = sql.all({ $q: `%${query}%` });

		if (results.length === 0) {
			return {
				content: [{ type: "text", text: "該当するメモは見つかりませんでした。" }],
			};
		}

		// 結果を整形して返す
		const formatted = results.map((r: any) =>
			`[ID:${r.id}] ${r.title} (${r.created_at})\n${r.content}`
		).join("\n---\n");

		return {
			content: [{ type: "text", text: `見つかったメモ:\n\n${formatted}` }],
		};
	}
);

// 3. サーバの起動 (標準入出力を使用)
const transport = new StdioServerTransport();
await server.connect(transport);

// ログは標準エラー出力に出す (標準出力はMCP通信で使うため)
console.error("Bun MCP Server running on stdio...");
