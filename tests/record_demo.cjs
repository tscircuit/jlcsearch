const { chromium } = require("@playwright/test");
const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");

async function main() {
  const videoDir = path.join(__dirname, "assets");
  if (!fs.existsSync(videoDir)) {
    fs.mkdirSync(videoDir, { recursive: true });
  }

  console.log("Starting server...");
  const server = spawn("bun", ["run", "scripts/start-server.ts"], {
    env: { ...process.env, PORT: "3065" }
  });

  server.stdout.on("data", (data) => {
    console.log(`[Server]: ${data.toString().trim()}`);
  });

  server.stderr.on("data", (data) => {
    console.error(`[Server Error]: ${data.toString().trim()}`);
  });

  // Wait 3 seconds for server to start
  await new Promise((resolve) => setTimeout(resolve, 3000));

  console.log("Launching browser...");
  const browser = await chromium.launch({ headless: true });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    recordVideo: {
      dir: videoDir,
      size: { width: 1280, height: 720 }
    }
  });

  const page = await context.newPage();

  try {
    console.log("Navigating to component list...");
    await page.goto("http://localhost:3065/components/list", { waitUntil: "networkidle" });
    await page.waitForTimeout(2000);

    console.log("Clicking Extended Promotional checkbox...");
    await page.check('input[name="is_extended_promotional"]');
    await page.waitForTimeout(1000);

    console.log("Clicking Filter button...");
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);

    console.log("Navigating to JSON output of components list with is_extended_promotional=true...");
    await page.goto("http://localhost:3065/components/list?json=true&is_extended_promotional=true&limit=10", {
      waitUntil: "networkidle"
    });
    await page.waitForTimeout(3000);

  } catch (error) {
    console.error("An error occurred during automation:", error);
  } finally {
    console.log("Closing context and saving video...");
    await context.close();
    await browser.close();

    console.log("Stopping server...");
    server.kill();

    // Find the created video file and rename it
    const files = fs.readdirSync(videoDir);
    const videoFile = files.find(f => f.endsWith(".webm") && f !== "jlcsearch_extended_promotional_demo.webm");
    if (videoFile) {
      const oldPath = path.join(videoDir, videoFile);
      const newPath = path.join(videoDir, "jlcsearch_extended_promotional_demo.webm");
      if (fs.existsSync(newPath)) {
        fs.unlinkSync(newPath);
      }
      fs.renameSync(oldPath, newPath);
      console.log(`Video demo successfully saved and renamed to: ${newPath}`);
    } else {
      console.log("Video file not found or not created.");
    }
    
    // Explicitly exit the process
    process.exit(0);
  }
}

main();
