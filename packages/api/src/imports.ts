import type { ScreenshotImport } from "@lofit/domain";
import { api, apiError, fromJson } from "./client";

export type Screenshot = {
    image: string;
    mediaType: "image/png" | "image/jpeg" | "image/webp" | "image/gif" | "application/pdf";
};

export async function importScreenshot(screenshot: Screenshot): Promise<ScreenshotImport> {
    const response = await api().imports.screenshot.$post({ json: screenshot });
    if (!response.ok) throw await apiError(response);
    return fromJson(await response.json());
}
