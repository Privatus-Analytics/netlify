/**
 * A small glob for paths inside the publish directory.
 *   *   any characters except /
 *   **  any characters including /
 *   ?   one character except /
 * A pattern that ends in / means everything below that directory.
 * A pattern with no / matches a file name anywhere ("draft.html").
 */
export const globToRegExp = (glob: string): RegExp => {
  let pattern = glob.trim().replace(/^\/+/, "");
  if (pattern.endsWith("/")) pattern = `${pattern}**`;
  const anywhere = !pattern.includes("/");
  let source = "";
  for (let i = 0; i < pattern.length; i += 1) {
    const char = pattern[i] as string;
    if (char === "*") {
      if (pattern[i + 1] === "*") {
        i += 1;
        // "**/" also matches no directory at all.
        if (pattern[i + 1] === "/") {
          i += 1;
          source += "(?:.*/)?";
        } else {
          source += ".*";
        }
      } else {
        source += "[^/]*";
      }
    } else if (char === "?") {
      source += "[^/]";
    } else {
      source += char.replace(/[.+^${}()|[\]\\]/g, "\\$&");
    }
  }
  return new RegExp(anywhere ? `^(?:.*/)?${source}$` : `^${source}$`);
};

export const matchesAny = (path: string, patterns: RegExp[]): boolean => patterns.some((pattern) => pattern.test(path));
