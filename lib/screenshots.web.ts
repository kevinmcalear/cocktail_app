// Web can't tell when someone takes a screenshot, so there's nothing to listen
// for or capture. A file of its own, so react-native-view-shot (whose web build
// needs html2canvas-pro) never reaches the web bundle. Same exports as
// screenshots.ts.

export function listenForScreenshots(_onScreenshot: () => void): (() => void) | null {
  return null;
}

export async function captureAppScreen(): Promise<string | null> {
  return null;
}
