import type { ScreenshotImport } from "@lofit/domain";
import { useMutation } from "@tanstack/react-query";
import { importScreenshot } from "./imports";
import type { Screenshot } from "./imports";

export function useImportScreenshot() {
    return useMutation<ScreenshotImport, Error, Screenshot>({ mutationFn: importScreenshot });
}
