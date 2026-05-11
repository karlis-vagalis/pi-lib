import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default function (pi: ExtensionAPI) {
    pi.on("session_shutdown", async (event, ctx) => {
        console.log(`Session   ${ctx.sessionManager.getSessionName()}`)
        console.log(`Continue  pi --session ${ctx.sessionManager.getSessionId()}`)
    });
}