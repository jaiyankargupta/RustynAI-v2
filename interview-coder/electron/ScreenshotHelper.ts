// ScreenshotHelper.ts

import path from "node:path";
import fs from "node:fs";
import { app } from "electron";
import { v4 as uuidv4 } from "uuid";
import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

export class ScreenshotHelper {
  private screenshotQueue: string[] = [];
  private extraScreenshotQueue: string[] = [];
  private readonly MAX_SCREENSHOTS = 10;

  private readonly screenshotDir: string;
  private readonly extraScreenshotDir: string;

  private view: "queue" | "solutions" | "debug" = "queue";

  constructor(view: "queue" | "solutions" | "debug" = "queue") {
    this.view = view;

    // Initialize directories
    this.screenshotDir = path.join(app.getPath("userData"), "screenshots");
    this.extraScreenshotDir = path.join(
      app.getPath("userData"),
      "extra_screenshots",
    );

    // Create directories if they don't exist
    if (!fs.existsSync(this.screenshotDir)) {
      fs.mkdirSync(this.screenshotDir);
    }
    if (!fs.existsSync(this.extraScreenshotDir)) {
      fs.mkdirSync(this.extraScreenshotDir);
    }
  }

  public getView(): "queue" | "solutions" | "debug" {
    return this.view;
  }

  public setView(view: "queue" | "solutions" | "debug"): void {
    console.log("Setting view in ScreenshotHelper:", view);
    console.log(
      "Current queues - Main:",
      this.screenshotQueue,
      "Extra:",
      this.extraScreenshotQueue,
    );
    this.view = view;
  }

  public getScreenshotQueue(): string[] {
    return this.screenshotQueue;
  }

  public getExtraScreenshotQueue(): string[] {
    console.log("Getting extra screenshot queue:", this.extraScreenshotQueue);
    return this.extraScreenshotQueue;
  }

  public clearQueues(): void {
    // Clear screenshotQueue
    this.screenshotQueue.forEach((screenshotPath) => {
      fs.unlink(screenshotPath, (err) => {
        if (err)
          console.error(`Error deleting screenshot at ${screenshotPath}:`, err);
      });
    });
    this.screenshotQueue = [];

    // Clear extraScreenshotQueue
    this.extraScreenshotQueue.forEach((screenshotPath) => {
      fs.unlink(screenshotPath, (err) => {
        if (err)
          console.error(
            `Error deleting extra screenshot at ${screenshotPath}:`,
            err,
          );
      });
    });
    this.extraScreenshotQueue = [];
  }

  private async captureScreenshotMac(): Promise<Buffer> {
    const tmpPath = path.join(app.getPath("temp"), `${uuidv4()}.png`);
    await execFileAsync("screencapture", ["-x", tmpPath]);
    const buffer = await fs.promises.readFile(tmpPath);
    await fs.promises.unlink(tmpPath);
    return buffer;
  }

  private async captureScreenshotWindows(): Promise<Buffer> {
    // Using PowerShell's native screenshot capability
    const tmpPath = path.join(app.getPath("temp"), `${uuidv4()}.png`);
    const script = `
      Add-Type -AssemblyName System.Windows.Forms
      Add-Type -AssemblyName System.Drawing
      $screen = [System.Windows.Forms.Screen]::PrimaryScreen
      $bitmap = New-Object System.Drawing.Bitmap $screen.Bounds.Width, $screen.Bounds.Height
      $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
      $graphics.CopyFromScreen($screen.Bounds.X, $screen.Bounds.Y, 0, 0, $bitmap.Size)
      $bitmap.Save('${tmpPath.replace(/\\/g, "\\\\")}')
      $graphics.Dispose()
      $bitmap.Dispose()
    `;
    await execFileAsync("powershell", ["-command", script]);
    const buffer = await fs.promises.readFile(tmpPath);
    await fs.promises.unlink(tmpPath);
    return buffer;
  }

  public async takeScreenshot(
    hideMainWindow: () => void,
    showMainWindow: () => void,
  ): Promise<string> {
    console.log("Taking screenshot in view:", this.view);
    hideMainWindow();
    await new Promise((resolve) => setTimeout(resolve, 100));

    let screenshotPath = "";
    try {
      // Get screenshot buffer using native methods
      const screenshotBuffer =
        process.platform === "darwin"
          ? await this.captureScreenshotMac()
          : await this.captureScreenshotWindows();

      // Save and manage the screenshot based on current view
      if (this.view === "queue") {
        screenshotPath = path.join(this.screenshotDir, `${uuidv4()}.png`);
        await fs.promises.writeFile(screenshotPath, screenshotBuffer);
        console.log("Adding screenshot to main queue:", screenshotPath);
        this.screenshotQueue.push(screenshotPath);
        if (this.screenshotQueue.length > this.MAX_SCREENSHOTS) {
          const removedPath = this.screenshotQueue.shift();
          if (removedPath) {
            try {
              await fs.promises.unlink(removedPath);
              console.log(
                "Removed old screenshot from main queue:",
                removedPath,
              );
            } catch (error) {
              console.error("Error removing old screenshot:", error);
            }
          }
        }
      } else {
        // In solutions view, only add to extra queue
        screenshotPath = path.join(this.extraScreenshotDir, `${uuidv4()}.png`);
        await fs.promises.writeFile(screenshotPath, screenshotBuffer);
        console.log("Adding screenshot to extra queue:", screenshotPath);
        this.extraScreenshotQueue.push(screenshotPath);
        if (this.extraScreenshotQueue.length > this.MAX_SCREENSHOTS) {
          const removedPath = this.extraScreenshotQueue.shift();
          if (removedPath) {
            try {
              await fs.promises.unlink(removedPath);
              console.log(
                "Removed old screenshot from extra queue:",
                removedPath,
              );
            } catch (error) {
              console.error("Error removing old screenshot:", error);
            }
          }
        }
      }
    } catch (error) {
      console.error("Screenshot error:", error);
      throw error;
    } finally {
      await new Promise((resolve) => setTimeout(resolve, 50));
      showMainWindow();
    }

    return screenshotPath;
  }

  public async getImagePreview(filepath: string): Promise<string> {
    try {
      const data = await fs.promises.readFile(filepath);
      return `data:image/png;base64,${data.toString("base64")}`;
    } catch (error) {
      console.error("Error reading image:", error);
      throw error;
    }
  }

  public async deleteScreenshot(
    path: string,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      await fs.promises.unlink(path);
      if (this.view === "queue") {
        this.screenshotQueue = this.screenshotQueue.filter(
          (filePath) => filePath !== path,
        );
      } else {
        this.extraScreenshotQueue = this.extraScreenshotQueue.filter(
          (filePath) => filePath !== path,
        );
      }
      return { success: true };
    } catch (error) {
      console.error("Error deleting file:", error);
      return { success: false, error: error.message };
    }
  }

  public clearExtraScreenshotQueue(): void {
    // Clear extraScreenshotQueue
    this.extraScreenshotQueue.forEach((screenshotPath) => {
      fs.unlink(screenshotPath, (err) => {
        if (err)
          console.error(
            `Error deleting extra screenshot at ${screenshotPath}:`,
            err,
          );
      });
    });
    this.extraScreenshotQueue = [];
  }

  // Method to convert screenshot paths to data objects with Base64 encoded image data
  public async getScreenshotData(
    screenshotPaths: string[],
  ): Promise<Array<{ path: string; data: string }>> {
    try {
      console.log(`Processing ${screenshotPaths.length} screenshots for OCR`);

      const results = await Promise.all(
        screenshotPaths.map(async (path) => {
          try {
            console.log(`Reading screenshot from: ${path}`);
            // Check if file exists first
            if (!fs.existsSync(path)) {
              console.error(`Screenshot file not found: ${path}`);
              return null;
            }

            // Get file stats to check size
            const stats = await fs.promises.stat(path);
            console.log(`Screenshot file size: ${stats.size} bytes`);

            if (stats.size === 0) {
              console.error(`Screenshot file is empty: ${path}`);
              return null;
            }

            // Read the file as binary buffer first
            const buffer = await fs.promises.readFile(path);

            // Convert buffer to base64
            const data = buffer.toString("base64");

            // Verify we got data
            if (!data || data.length === 0) {
              console.error(`Failed to read data from ${path}`);
              return null;
            }

            console.log(
              `Successfully read ${data.length} bytes of base64 data`,
            );

            // Prefix with data:image/png;base64, for proper OCR processing
            return {
              path,
              data: `data:image/png;base64,${data}`,
            };
          } catch (error) {
            console.error(`Error reading screenshot at ${path}:`, error);
            return null;
          }
        }),
      );

      // Filter out any nulls from failed reads
      const validResults = results.filter(
        (result): result is { path: string; data: string } => result !== null,
      );

      console.log(
        `Successfully processed ${validResults.length}/${screenshotPaths.length} screenshots`,
      );

      return validResults;
    } catch (error) {
      console.error("Error processing screenshot data:", error);
      return [];
    }
  }
}
