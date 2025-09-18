import { globalShortcut, app } from "electron";
import { IShortcutsHelperDeps } from "./main";

export class ShortcutsHelper {
  private deps: IShortcutsHelperDeps;

  constructor(deps: IShortcutsHelperDeps) {
    this.deps = deps;
  }

  public registerGlobalShortcuts(): void {
    globalShortcut.register("CommandOrControl+H", async () => {
      const mainWindow = this.deps.getMainWindow();
      if (mainWindow) {
        console.log("Taking screenshot...");
        try {
          const screenshotPath = await this.deps.takeScreenshot();
          // Get the preview and send it to the UI
          const preview = await this.deps.getImagePreview(screenshotPath);
          // Send both the path and preview data
          mainWindow.webContents.send("screenshot-taken", {
            path: screenshotPath,
            preview,
          });
        } catch (error) {
          console.error("Error capturing screenshot:", error);
        }
      }
    });

    // Add shortcut to remove the previous screenshot (Command+G)
    globalShortcut.register("CommandOrControl+G", async () => {
      const mainWindow = this.deps.getMainWindow();
      if (mainWindow) {
        console.log("Removing previous screenshot...");
        try {
          // Use the getScreenshotQueue function directly
          const queue = this.deps.getScreenshotQueue();
          console.log("Current screenshot queue:", queue);

          if (queue.length > 0) {
            // Get the last screenshot
            const lastScreenshotPath = queue[queue.length - 1];
            console.log("Removing screenshot path:", lastScreenshotPath);

            // Delete it
            await this.deps.deleteScreenshot(lastScreenshotPath);
            console.log("Screenshot deleted successfully");

            // Send screenshot-taken event with empty data to trigger UI update
            mainWindow.webContents.send("screenshot-taken", {
              path: "",
              preview: "",
            });
          } else {
            console.log("No screenshots to remove");
          }
        } catch (error) {
          console.error("Error removing previous screenshot:", error);
        }
      }
    });

    globalShortcut.register("CommandOrControl+Enter", async () => {
      await this.deps.processingHelper?.processScreenshots();
    });

    globalShortcut.register("CommandOrControl+R", () => {
      console.log(
        "Command + Shift + R pressed. Canceling requests and resetting queues...",
      );

      // Cancel ongoing API requests
      this.deps.processingHelper?.cancelOngoingRequests();

      // Clear both screenshot queues
      this.deps.clearQueues();

      console.log("Cleared queues.");

      // Update the view state to 'queue'
      this.deps.setView("queue");

      // Notify renderer process to switch view to 'queue'
      const mainWindow = this.deps.getMainWindow();
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send("reset-view");
        mainWindow.webContents.send("reset");
      }
    });

    // New shortcuts for moving the window
    globalShortcut.register("CommandOrControl+Left", () => {
      console.log("Command/Ctrl + Left pressed. Moving window left.");
      this.deps.moveWindowLeft();
    });

    globalShortcut.register("CommandOrControl+Right", () => {
      console.log("Command/Ctrl + Right pressed. Moving window right.");
      this.deps.moveWindowRight();
    });

    globalShortcut.register("CommandOrControl+Down", () => {
      console.log("Command/Ctrl + down pressed. Moving window down.");
      this.deps.moveWindowDown();
    });

    globalShortcut.register("CommandOrControl+Up", () => {
      console.log("Command/Ctrl + Up pressed. Moving window Up.");
      this.deps.moveWindowUp();
    });

    globalShortcut.register("CommandOrControl+Shift+Up", () => {
      console.log("Command/Ctrl + Shift + Up pressed. Increasing opacity.");
      this.deps.increaseOpacity();
    });

    globalShortcut.register("CommandOrControl+Shift+Down", () => {
      console.log("Command/Ctrl + Shift + Down pressed. Decreasing opacity.");
      this.deps.decreaseOpacity();
    });

    globalShortcut.register("CommandOrControl+B", () => {
      this.deps.toggleMainWindow();
    });

    // Unregister shortcuts when quitting
    app.on("will-quit", () => {
      globalShortcut.unregisterAll();
    });
  }
}
