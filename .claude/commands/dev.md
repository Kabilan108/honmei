# Start Development Environment

Set up the development environment for this session:

1. **Check for existing tmux 'servers' pane:**
   - If a tmux pane named 'servers' already exists, note that dev servers may already be running there
   - Use it to check logs during development when troubleshooting issues

2. **If no 'servers' pane exists:**
   - Create a new tmux window named 'servers' with a vertical split
   - Run `bun run dev` in the left pane (Vite dev server on port 5173)
   - Run `bunx convex dev` in the right pane (Convex backend)

3. **Open the app in Chrome:**
   - Use the browser MCP tools to get tab context
   - Create a new tab and navigate to http://localhost:5173
   - Take a screenshot to confirm the app is running

Throughout this session, check the 'servers' tmux pane logs when debugging build errors or runtime issues.
