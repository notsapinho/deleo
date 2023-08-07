export const removeColors = (text: string): string => text.replace(/\x1b[^m]*m/g, "");
