import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import express from "express";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import "dotenv/config";
import mysql from "mysql2/promise";

// Yhteys tietokantaan
const conn = await mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

// Express-palvelin
const app = express();
app.use(express.json());

// MCP HTTP POST
app.post("/", async (req, res) => {
  try {
    // Luodaan uusi MCP-palvelin jokaista HTTP-yhteyttä varten
    const server = new McpServer({
      name: "opinnaytetyo-mcp",
      version: "1.0.0",
    });

    // Tool 1: Hae kaikki opinnäytetyön vaiheet
    server.registerTool(
      "hae-vaiheet",
      {
        title: "hae-vaiheet",
        description: "Hakee opinnäytetyön vaiheet tietokannasta",
        inputSchema: z.object({}),
      },
      async () => {
        try {
          const [rows] = await conn.query("SELECT vaihe FROM vaiheet");

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(rows),
              },
            ],
          };
        } catch (error) {
          console.error("Virhe vaiheiden haussa:", error);

          return {
            content: [
              {
                type: "text",
                text: "Vaiheiden hakeminen epäonnistui.",
              },
            ],
            isError: true,
          };
        }
      },
    );

    // Tool 2: Hae tietyn vaiheen selitys
    server.registerTool(
      "hae-vaiheen-selitys",
      {
        title: "hae-vaiheen-selitys",
        description:
          "Hakee tietyn opinnäytetyön vaiheen selityksen tietokannasta",
        inputSchema: z.object({
          vaihe: z.string().describe("Haettavan opinnäytetyön vaiheen nimi"),
        }),
      },
      async ({ vaihe }) => {
        try {
          const like = `%${vaihe}%`;

          const [rows] = await conn.query(
            "SELECT selitys FROM vaiheet WHERE vaihe LIKE ?",
            [like],
          );

          if (rows.length === 0) {
            return {
              content: [
                {
                  type: "text",
                  text: `Vaihetta "${vaihe}" ei löytynyt.`,
                },
              ],
            };
          }

          return {
            content: [
              {
                type: "text",
                text: rows.map((row) => row.selitys).join("\n"),
              },
            ],
          };
        } catch (error) {
          console.error("Virhe vaiheen selityksen haussa:", error);

          return {
            content: [
              {
                type: "text",
                text: "Vaiheen selityksen hakeminen epäonnistui.",
              },
            ],
            isError: true,
          };
        }
      },
    );

    // Luodaan uusi Streamable HTTP -transport
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });

    // Yhdistetään MCP-palvelin transportiin
    await server.connect(transport);

    // Käsitellään MCP-pyyntö
    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    console.error(error);

    if (!res.headersSent) {
      res.status(500).json({
        error: error.message,
      });
    }
  }
});

// Käynnistetään palvelin
app.listen(3000, () => {
  console.log("MCP server running on port 3000");
});
