import React from "react";
// Import removed as we're not using ScreenshotItem anymore

interface Screenshot {
  path: string;
  preview: string;
}

interface ScreenshotQueueProps {
  isLoading: boolean;
  screenshots: Screenshot[];
  onDeleteScreenshot: (index: number) => void;
}
const ScreenshotQueue: React.FC<ScreenshotQueueProps> = ({
  isLoading,
  screenshots,
  onDeleteScreenshot,
}) => {
  if (screenshots.length === 0) {
    return <></>;
  }

  // Don't display any images
  return null;
};

export default ScreenshotQueue;
