// ipcHandlers.ts

import { ipcMain, shell } from "electron";

import { IIpcHandlerDeps } from "./main";

export function initializeIpcHandlers(deps: IIpcHandlerDeps): void {
  ipcMain.handle("process-screenshots-with-payload", async (event, payload) => {
    try {
      const result = await deps.processingHelper?.processScreenshots(payload);
      return (
        result || { success: false, error: "No result from ProcessingHelper" }
      );
    } catch (error) {
      console.error("Error processing screenshots with payload:", error);
      return { success: false, error: "Failed to process screenshots" };
    }
  });
  console.log("Initializing IPC handlers");

  // Screenshot queue handlers
  ipcMain.handle("get-screenshot-queue", () => {
    return deps.getScreenshotQueue();
  });

  ipcMain.handle("get-extra-screenshot-queue", () => {
    return deps.getExtraScreenshotQueue();
  });

  ipcMain.handle("delete-screenshot", async (event, path: string) => {
    return deps.deleteScreenshot(path);
  });

  ipcMain.handle("get-image-preview", async (event, path: string) => {
    return deps.getImagePreview(path);
  });

  // Screenshot processing handlers
  ipcMain.handle("process-screenshots", async () => {
    await deps.processingHelper?.processScreenshots();
  });

  // Window dimension handlers
  ipcMain.handle(
    "update-content-dimensions",
    async (event, { width, height }: { width: number; height: number }) => {
      if (width && height) {
        deps.setWindowDimensions(width, height);
      }
    },
  );

  ipcMain.handle(
    "set-window-dimensions",
    (event, width: number, height: number) => {
      deps.setWindowDimensions(width, height);
    },
  );

  // Screenshot management handlers
  ipcMain.handle("get-screenshots", async () => {
    try {
      let previews = [];
      const currentView = deps.getView();

      if (currentView === "queue") {
        const queue = deps.getScreenshotQueue();
        previews = await Promise.all(
          queue.map(async (path) => ({
            path,
            preview: await deps.getImagePreview(path),
          })),
        );
      } else {
        const extraQueue = deps.getExtraScreenshotQueue();
        previews = await Promise.all(
          extraQueue.map(async (path) => ({
            path,
            preview: await deps.getImagePreview(path),
          })),
        );
      }

      return previews;
    } catch (error) {
      console.error("Error getting screenshots:", error);
      throw error;
    }
  });

  // Screenshot trigger handlers
  ipcMain.handle("trigger-screenshot", async () => {
    console.log("IPC: trigger-screenshot called");
    const mainWindow = deps.getMainWindow();
    if (mainWindow) {
      try {
        console.log("Taking screenshot...");
        const screenshotPath = await deps.takeScreenshot();
        console.log(`Screenshot taken and saved at: ${screenshotPath}`);

        // Send the screenshot data to the UI
        console.log("Taking screenshot and notifying renderer");
        const preview = await deps.getImagePreview(screenshotPath);
        mainWindow.webContents.send("screenshot-taken", {
          path: screenshotPath,
          preview,
        });
        return { success: true };
      } catch (error) {
        console.error("Error triggering screenshot:", error);
        return {
          success: false,
          error: `Failed to trigger screenshot: ${error}`,
        };
      }
    }
    console.warn("No main window available");
    return { success: false, error: "No main window available" };
  });

  ipcMain.handle("remove-previous-screenshot", async () => {
    console.log("IPC: remove-previous-screenshot called");
    try {
      // Get the screenshot queue directly from deps
      const queue = deps.getScreenshotQueue();
      console.log(`Found ${queue.length} screenshots in queue`);

      if (queue.length > 0) {
        const lastScreenshotPath = queue[queue.length - 1];
        console.log(`Removing screenshot: ${lastScreenshotPath}`);

        await deps.deleteScreenshot(lastScreenshotPath);
        console.log("Screenshot successfully deleted");

        const mainWindow = deps.getMainWindow();
        if (mainWindow) {
          console.log("Sending screenshot-taken event to renderer");
          mainWindow.webContents.send("screenshot-taken", {
            path: "",
            preview: "",
          });
        } else {
          console.warn("Main window not available, cannot update UI");
        }
        return { success: true };
      }
      console.log("No screenshots to remove");
      return { success: false, error: "No screenshots to remove" };
    } catch (error) {
      console.error("Error removing previous screenshot:", error);
      return {
        success: false,
        error: `Failed to remove previous screenshot: ${error}`,
      };
    }
  });

  ipcMain.handle("take-screenshot", async () => {
    try {
      const screenshotPath = await deps.takeScreenshot();
      const preview = await deps.getImagePreview(screenshotPath);
      return { path: screenshotPath, preview };
    } catch (error) {
      console.error("Error taking screenshot:", error);
      return { error: "Failed to take screenshot" };
    }
  });

  ipcMain.handle("open-external-url", (event, url: string) => {
    shell.openExternal(url);
  });

  // Window management handlers
  ipcMain.handle("toggle-window", () => {
    try {
      deps.toggleMainWindow();
      return { success: true };
    } catch (error) {
      console.error("Error toggling window:", error);
      return { error: "Failed to toggle window" };
    }
  });

  ipcMain.handle("reset-queues", async () => {
    try {
      deps.clearQueues();
      return { success: true };
    } catch (error) {
      console.error("Error resetting queues:", error);
      return { error: "Failed to reset queues" };
    }
  });

  // Process screenshot handlers
  ipcMain.handle("trigger-process-screenshots", async () => {
    try {
      await deps.processingHelper?.processScreenshots();
      return { success: true };
    } catch (error) {
      console.error("Error processing screenshots:", error);
      return { error: "Failed to process screenshots" };
    }
  });

  // Reset handlers
  ipcMain.handle("trigger-reset", () => {
    try {
      // First cancel any ongoing requests
      deps.processingHelper?.cancelOngoingRequests();

      // Clear all queues immediately
      deps.clearQueues();

      // Reset view to queue
      deps.setView("queue");

      // Get main window and send reset events
      const mainWindow = deps.getMainWindow();
      if (mainWindow && !mainWindow.isDestroyed()) {
        // Send reset events in sequence
        mainWindow.webContents.send("reset-view");
        mainWindow.webContents.send("reset");
      }

      return { success: true };
    } catch (error) {
      console.error("Error triggering reset:", error);
      return { error: "Failed to trigger reset" };
    }
  });

  // Window movement handlers
  ipcMain.handle("trigger-move-left", () => {
    try {
      deps.moveWindowLeft();
      return { success: true };
    } catch (error) {
      console.error("Error moving window left:", error);
      return { error: "Failed to move window left" };
    }
  });

  ipcMain.handle("trigger-move-right", () => {
    try {
      deps.moveWindowRight();
      return { success: true };
    } catch (error) {
      console.error("Error moving window right:", error);
      return { error: "Failed to move window right" };
    }
  });

  ipcMain.handle("trigger-move-up", () => {
    try {
      deps.moveWindowUp();
      return { success: true };
    } catch (error) {
      console.error("Error moving window up:", error);
      return { error: "Failed to move window up" };
    }
  });

  ipcMain.handle("trigger-move-down", () => {
    try {
      deps.moveWindowDown();
      return { success: true };
    } catch (error) {
      console.error("Error moving window down:", error);
      return { error: "Failed to move window down" };
    }
  });
}
