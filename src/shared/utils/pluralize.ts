export const pluralize = (word: string, count: number) =>
    count === 1 ? word : `${word}s`;
