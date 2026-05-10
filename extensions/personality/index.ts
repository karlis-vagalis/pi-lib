import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { readFile, readdir } from "node:fs/promises";
import { parseFrontmatter } from "@earendil-works/pi-coding-agent";
import { getAgentDir } from "@earendil-works/pi-coding-agent";

interface Personality {
    name: string;
    description: string;
    instructions: string;
}

type PersonalityRegistry = Record<string, Personality>;

async function loadPersonalitiesFromDir(dirPath: string): Promise<PersonalityRegistry> {
    const personalities: PersonalityRegistry = {};

    if (!existsSync(dirPath)) {
        return personalities;
    }

    const entries = await readdir(dirPath);
    const mdFiles = entries.filter((f) => f.endsWith(".md"));

    for (const file of mdFiles) {
        const filePath = join(dirPath, file);
        const content = await readFile(filePath, "utf-8");
        const { frontmatter, body } = parseFrontmatter(content);

        let name: string;
        if (frontmatter.name && typeof frontmatter.name === "string") {
            name = frontmatter.name;
        } else {
            name = file.replace(/\.md$/, "");
        }

        const description =
            frontmatter.description && typeof frontmatter.description === "string"
                ? frontmatter.description
                : "";

        personalities[name] = {
            name,
            description,
            instructions: body.trim(),
        };
    }

    return personalities;
}

async function loadPersonalities(cwd: string): Promise<PersonalityRegistry> {
    const globalPath = join(getAgentDir(), "personalities");
    const projectPath = join(cwd, ".pi", "personalities");

    const globalPersonalities = await loadPersonalitiesFromDir(globalPath);
    const projectPersonalities = await loadPersonalitiesFromDir(projectPath);

    return { ...globalPersonalities, ...projectPersonalities };
}

export default function (pi: ExtensionAPI) {
    let personalities: PersonalityRegistry | undefined;
    let activePersonality: string | undefined;

    pi.on("session_start", async (_event, ctx) => {
        personalities = await loadPersonalities(ctx.cwd);
    });

    pi.on("before_agent_start", async (event, ctx) => {
        if (!personalities || !activePersonality) {
            return;
        }

        const personality = personalities[activePersonality];
        if (!personality) {
            return;
        }

        return {
            systemPrompt:
                event.systemPrompt +
                `\n\n=== PERSONALITY: ${personality.name} ===\n${personality.instructions}\n=== END PERSONALITY ===`,
        };
    });

    pi.registerCommand("personality", {
        description: "Choose an active personality",
        handler: async (_args, ctx) => {
            if (!personalities) {
                ctx.ui.notify("Personalities not loaded yet.", "error");
                return;
            }

            const names = Object.keys(personalities);
            if (names.length === 0) {
                ctx.ui.notify("No personalities found.", "info");
                return;
            }

            const displayName = (name: string) => {
                const p = personalities[name];
                if (p.description) {
                    return `${p.name}: ${p.description}`;
                }
                return p.name;
            };

            const choice = await ctx.ui.select(
                "Select a personality",
                names.map((name) => displayName(name)),
            );

            if (choice) {
                const index = names.findIndex((n) => displayName(n) === choice);
                if (index !== -1) {
                    activePersonality = names[index];
                    const personality = personalities[activePersonality];
                    ctx.ui.notify(`Active personality: ${personality.name}`, "info");
                }
            }
        },
    });
}
