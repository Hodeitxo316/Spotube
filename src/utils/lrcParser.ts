// src/utils/lrcParser.ts

export interface LyricLine {
  time: number;
  text: string;
}

export const parseLrc = (
  lrcText: string
): LyricLine[] => {
  if (
    typeof lrcText !== 'string' ||
    !lrcText.trim()
  ) {
    return [];
  }

  const result: LyricLine[] = [];

  // Admite [mm:ss.xx] y [mm:ss.xxx].
  const timeRegex =
    /\[(\d{2,}):(\d{2})(?:\.(\d{2,3}))?\]/g;

  const lines = lrcText.split(/\r?\n/);

  for (const line of lines) {
    const matches = Array.from(
      line.matchAll(timeRegex)
    );

    if (matches.length === 0) {
      continue;
    }

    // El texto es todo lo que queda después
    // de eliminar las marcas de tiempo.
    const text = line
      .replace(timeRegex, '')
      .trim();

    if (!text) {
      continue;
    }

    for (const match of matches) {
      const minutes = Number(match[1]);
      const seconds = Number(match[2]);
      const fraction = match[3] || '0';

      if (
        !Number.isFinite(minutes) ||
        !Number.isFinite(seconds) ||
        seconds >= 60
      ) {
        continue;
      }

      const milliseconds = Number(
        fraction.padEnd(3, '0')
      );

      const time =
        minutes * 60 +
        seconds +
        milliseconds / 1000;

      result.push({
        time,
        text,
      });
    }
  }

  return result.sort(
    (a, b) => a.time - b.time
  );
};