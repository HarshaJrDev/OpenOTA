import fse from "fs-extra";

export async function verifyAssetsCollected(assetsDir: string): Promise<number> {
  if (!(await fse.pathExists(assetsDir))) {
    return 0;
  }

  const entries = await fse.readdir(assetsDir);
  return entries.length;
}

/** Relative paths (from `assetsDir`) of every file in the assets directory, recursively. */
export async function listAssetPaths(assetsDir: string): Promise<string[]> {
  if (!(await fse.pathExists(assetsDir))) {
    return [];
  }

  const walk = async (dir: string, prefix: string): Promise<string[]> => {
    const entries = await fse.readdir(dir, { withFileTypes: true });
    const paths: string[] = [];

    for (const entry of entries) {
      const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;

      if (entry.isDirectory()) {
        paths.push(...(await walk(`${dir}/${entry.name}`, relativePath)));
      } else {
        paths.push(relativePath);
      }
    }

    return paths;
  };

  return walk(assetsDir, "");
}
