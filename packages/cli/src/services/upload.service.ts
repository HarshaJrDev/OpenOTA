import { createReadStream } from "node:fs";

import type { AxiosInstance } from "axios";
import type { Manifest } from "@openota/shared";
import FormData from "form-data";
import fse from "fs-extra";

import type { UploadOptions } from "../types/index.js";

export async function uploadPackage(
  client: AxiosInstance,
  endpoint: string,
  options: UploadOptions,
  onProgress?: (percent: number) => void,
): Promise<Manifest> {
  const stat = await fse.stat(options.zipPath);

  const form = new FormData();
  form.append("platform", options.platform);
  form.append("version", options.version);
  form.append("runtimeVersion", options.runtimeVersion);
  form.append("bundleName", options.bundleName);
  form.append("sha256", options.sha256);
  form.append("size", String(options.size));
  if (options.channel) {
    form.append("channel", options.channel);
  }
  form.append("file", createReadStream(options.zipPath), {
    filename: "ota-package.zip",
    contentType: "application/zip",
    knownLength: stat.size,
  });

  const response = await client.post<{ success: true; data: Manifest }>(
    endpoint,
    form,
    {
      headers: form.getHeaders(),
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
      onUploadProgress: (event) => {
        if (onProgress && event.total) {
          onProgress(Math.round((event.loaded / event.total) * 100));
        }
      },
    },
  );

  return response.data.data;
}
