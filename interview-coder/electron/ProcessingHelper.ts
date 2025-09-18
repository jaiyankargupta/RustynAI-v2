// ProcessingHelper.ts
import fs from "node:fs";
import { ScreenshotHelper } from "./ScreenshotHelper";
import { IProcessingHelperDeps } from "./main";
import axios from "axios";
import { app } from "electron";
import { BrowserWindow } from "electron";

const isDev = !app.isPackaged;
const API_BASE_URL = "http://localhost:3001";

//"http://localhost:3001";

// https://rustyn-ai.vercel.app

export class ProcessingHelper {
  private deps: IProcessingHelperDeps;
  private screenshotHelper: ScreenshotHelper;

  // AbortControllers for API requests
  private currentProcessingAbortController: AbortController | null = null;
  private currentExtraProcessingAbortController: AbortController | null = null;

  constructor(deps: IProcessingHelperDeps) {
    this.deps = deps;
    this.screenshotHelper = deps.getScreenshotHelper();
  }

  private async waitForInitialization(
    mainWindow: BrowserWindow
  ): Promise<void> {
    let attempts = 0;
    const maxAttempts = 50; // 5 seconds total

    while (attempts < maxAttempts) {
      const isInitialized = await mainWindow.webContents.executeJavaScript(
        "window.__IS_INITIALIZED__"
      );
      if (isInitialized) return;
      await new Promise((resolve) => setTimeout(resolve, 100));
      attempts++;
    }
    throw new Error("App failed to initialize after 5 seconds");
  }

  public async processScreenshots(payload?: {
    textList?: string[];
    language?: string;
  }): Promise<{ success: boolean; error?: string; data?: any } | void> {
    const mainWindow = this.deps.getMainWindow();
    if (!mainWindow) {
      console.log(
        "[ProcessingHelper] No mainWindow found, aborting processScreenshots."
      );
      return;
    }

    const view = this.deps.getView();
    console.log(
      "[ProcessingHelper] processScreenshots called with view:",
      view
    );
    console.log("[ProcessingHelper] Received payload:", payload);

    // If payload is provided, use it for direct API call
    if (
      payload &&
      payload.textList &&
      Array.isArray(payload.textList) &&
      payload.textList.length > 0
    ) {
      console.log(
        "[ProcessingHelper] Valid payload received, calling /api/generate with:",
        payload.textList,
        payload.language
      );
      try {
        this.currentProcessingAbortController = new AbortController();
        const { signal } = this.currentProcessingAbortController;
        const language = payload.language || "cpp";
        console.log(
          `Processing direct text input with ${payload.textList.length} items`
        );
        // Directly call /api/generate with textList and language
        const response = await axios.post(
          `${API_BASE_URL}/api/generate`,
          {
            textList: payload.textList,
            language,
            requestId: Date.now(), // Add request ID for tracking
          },
          {
            signal,
            timeout: 300000,
            validateStatus: function (status) {
              return status < 500;
            },
            maxRedirects: 5,
            headers: {
              "Content-Type": "application/json",
            },
          }
        );
        console.log(
          `API direct text response received with status: ${response.status}`
        );
        mainWindow.webContents.send(
          this.deps.PROCESSING_EVENTS.SOLUTION_SUCCESS,
          response.data
        );
        return { success: true, data: response.data };
      } catch (error: any) {
        mainWindow.webContents.send(
          this.deps.PROCESSING_EVENTS.INITIAL_SOLUTION_ERROR,
          error.message || "Server error. Please try again."
        );
        console.error("Processing error:", error);
        if (axios.isCancel(error)) {
          mainWindow.webContents.send(
            this.deps.PROCESSING_EVENTS.INITIAL_SOLUTION_ERROR,
            "Processing was canceled by the user."
          );
        }
        // Reset view back to queue on error
        console.log("Resetting view to queue due to error");
        this.deps.setView("queue");
        return {
          success: false,
          error: error.message || "Server error. Please try again.",
        };
      } finally {
        this.currentProcessingAbortController = null;
      }
    }
    if (view === "queue") {
      mainWindow.webContents.send(this.deps.PROCESSING_EVENTS.INITIAL_START);
      const screenshotQueue = this.screenshotHelper.getScreenshotQueue();
      console.log("Processing main queue screenshots:", screenshotQueue);
      if (screenshotQueue.length === 0) {
        mainWindow.webContents.send(this.deps.PROCESSING_EVENTS.NO_SCREENSHOTS);
        return;
      }
      try {
        this.currentProcessingAbortController = new AbortController();
        const { signal } = this.currentProcessingAbortController;

        // Process the screenshots and extract text data
        console.log(
          `Processing ${screenshotQueue.length} screenshots from queue`
        );
        const screenshots = await this.screenshotHelper.getScreenshotData(
          screenshotQueue
        );

        if (screenshots.length === 0) {
          console.error("No valid screenshots found in queue");
          mainWindow.webContents.send(
            this.deps.PROCESSING_EVENTS.NO_SCREENSHOTS
          );
          return;
        }

        console.log(
          `Successfully processed ${screenshots.length}/${screenshotQueue.length} screenshots`
        );

        // Extract the image data from screenshots
        const imageDataList = screenshots.map((screenshot) => screenshot.data);
        console.log(`Prepared ${imageDataList.length} images for processing`);

        // Make API call to process the screenshots
        console.log(
          `Sending ${imageDataList.length} images for OCR processing`
        );
        // Add timestamp to help identify request in logs
        const requestId = Date.now();
        console.log(`Request ID: ${requestId}`);

        const response = await axios.post(
          `${API_BASE_URL}/api/generate`,
          {
            imageDataList: imageDataList,
            language: "cpp",
            requestId: requestId,
          },
          {
            signal,
            timeout: 300000,
            validateStatus: function (status) {
              return status < 500;
            },
            maxRedirects: 5,
            headers: {
              "Content-Type": "application/json",
            },
          }
        );

        // Log response status
        console.log(`API response received with status: ${response.status}`);

        // Send success event with data
        mainWindow.webContents.send(
          this.deps.PROCESSING_EVENTS.SOLUTION_SUCCESS,
          response.data
        );

        return { success: true, data: response.data };
      } catch (error: any) {
        console.error("Processing error:", error);
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send(
            this.deps.PROCESSING_EVENTS.INITIAL_SOLUTION_ERROR,
            error.message || "Server error. Please try again."
          );
        }

        if (axios.isCancel(error)) {
          mainWindow.webContents.send(
            this.deps.PROCESSING_EVENTS.INITIAL_SOLUTION_ERROR,
            "Processing was canceled by the user."
          );
        }

        // Reset view back to queue on error
        console.log("Resetting view to queue due to error");
        this.deps.setView("queue");

        return {
          success: false,
          error: error.message || "Server error. Please try again.",
        };
      } finally {
        this.currentProcessingAbortController = null;
      }
    } else {
      // ...existing code for solutions view...
    }
  }

  private async generateSolutionsHelper(signal: AbortSignal) {
    try {
      const problemInfo = this.deps.getProblemInfo();
      const language = "cpp";

      if (!problemInfo) {
        throw new Error("No problem info available");
      }

      const response = await axios.post(
        `${API_BASE_URL}/api/generate`,
        { ...problemInfo, language },
        {
          signal,
          timeout: 300000,
          validateStatus: function (status) {
            return status < 500;
          },
          maxRedirects: 5,
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      return { success: true, data: response.data };
    } catch (error: any) {
      const mainWindow = this.deps.getMainWindow();

      // Handle timeout errors (both 504 and axios timeout)
      if (error.code === "ECONNABORTED" || error.response?.status === 504) {
        // Cancel ongoing API requests
        this.cancelOngoingRequests();
        // Clear both screenshot queues
        this.deps.clearQueues();
        // Update view state to queue
        this.deps.setView("queue");
        // Notify renderer to switch view
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send("reset-view");
          mainWindow.webContents.send(
            this.deps.PROCESSING_EVENTS.INITIAL_SOLUTION_ERROR,
            "Request timed out. The server took too long to respond. Please try again."
          );
        }
        return {
          success: false,
          error: "Request timed out. Please try again.",
        };
      }

      if (error.response?.data?.error?.includes("OpenAI API key not found")) {
        console.log("OpenAI API key not found");
      }

      if (
        error.response?.data?.error?.includes(
          "Please close this window and re-enter a valid Open AI API key."
        )
      ) {
        console.log(
          "Please close this window and re-enter a valid Open AI API key."
        );
      }

      return { success: false, error: error.message };
    }
  }

  private async processExtraScreenshotsHelper(
    screenshots: Array<{ path: string; data: string }>,
    signal: AbortSignal
  ) {
    try {
      const imageDataList = screenshots.map((screenshot) => screenshot.data);
      const problemInfo = this.deps.getProblemInfo();
      const language = "cpp";

      if (!problemInfo) {
        throw new Error("No problem info available");
      }

      console.log(
        `Sending ${imageDataList.length} images for debug OCR processing`
      );
      const requestId = Date.now();
      console.log(`Debug Request ID: ${requestId}`);

      const response = await axios.post(
        `${API_BASE_URL}/api/debug`,
        {
          imageDataList: imageDataList,
          problemInfo,
          language,
          requestId: requestId,
        },
        {
          signal,
          timeout: 300000,
          validateStatus: function (status) {
            return status < 500;
          },
          maxRedirects: 5,
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      console.log(
        `Debug API response received with status: ${response.status}`
      );

      return { success: true, data: response.data };
    } catch (error: any) {
      const mainWindow = this.deps.getMainWindow();

      // Handle cancellation first
      if (axios.isCancel(error)) {
        return {
          success: false,
          error: "Processing was canceled by the user.",
        };
      }

      if (
        error.response?.data?.error?.includes("Operation timed out") ||
        error.response?.data?.error?.includes("OCR") ||
        error.message.includes("timeout")
      ) {
        // Cancel ongoing API requests
        this.cancelOngoingRequests();
        // Clear both screenshot queues
        this.deps.clearQueues();
        // Update view state to queue
        this.deps.setView("queue");
        // Notify renderer to switch view
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send("reset-view");
          mainWindow.webContents.send(
            this.deps.PROCESSING_EVENTS.DEBUG_ERROR,
            error.response?.data?.error ||
              error.message ||
              "Operation failed. Please try again with clearer screenshots."
          );
        }
        return {
          success: false,
          error:
            error.response?.data?.error ||
            error.message ||
            "Operation failed. Please try again with clearer screenshots.",
        };
      }

      if (error.response?.data?.error?.includes("OpenAI API key not found")) {
        console.log("OpenAI API key not found");
      }

      if (
        error.response?.data?.error?.includes(
          "Please close this window and re-enter a valid Open AI API key."
        )
      ) {
        console.log(
          "Please close this window and re-enter a valid Open AI API key."
        );
      }

      return { success: false, error: error.message };
    }
  }

  public cancelOngoingRequests(): void {
    let wasCancelled = false;

    if (this.currentProcessingAbortController) {
      this.currentProcessingAbortController.abort();
      this.currentProcessingAbortController = null;
      wasCancelled = true;
    }

    if (this.currentExtraProcessingAbortController) {
      this.currentExtraProcessingAbortController.abort();
      this.currentExtraProcessingAbortController = null;
      wasCancelled = true;
    }

    // Reset hasDebugged flag
    this.deps.setHasDebugged(false);

    // Clear any pending state
    this.deps.setProblemInfo(null);

    const mainWindow = this.deps.getMainWindow();
    if (wasCancelled && mainWindow && !mainWindow.isDestroyed()) {
      // Send a clear message that processing was cancelled
      mainWindow.webContents.send(this.deps.PROCESSING_EVENTS.NO_SCREENSHOTS);
    }
  }
}
