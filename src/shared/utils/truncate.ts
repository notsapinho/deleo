export const truncate = (str: string, len: number) =>
    str.length > len ? `${str.slice(0, len - 3)}...` : str;
